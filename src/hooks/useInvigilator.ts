import { useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';

export enum ViolationType {
  TAB_SWITCH = 'TAB_SWITCH',
  FULLSCREEN_EXIT = 'FULLSCREEN_EXIT',
  COPY_PASTE = 'COPY_PASTE',
  DEV_TOOLS = 'DEV_TOOLS',
  FOCUS_LOSS = 'FOCUS_LOSS',
  CONTEXT_MENU = 'CONTEXT_MENU'
}

export interface ViolationEvent {
  type: ViolationType;
  timestamp: Date;
  details?: any;
}

interface InvigilatorConfig {
  enableFullscreen: boolean;
  enableTabSwitchDetection: boolean;
  enableCopyPasteDetection: boolean;
  enableDevToolsDetection: boolean;
  enableFocusDetection: boolean;
  enableContextMenuBlocking: boolean;
}

interface UseInvigilatorProps {
  sessionId: string;
  socket: Socket | null;
  onViolation?: (violation: ViolationEvent) => void;
  config?: Partial<InvigilatorConfig>;
  isActive?: boolean;
}

const DEFAULT_CONFIG: InvigilatorConfig = {
  enableFullscreen: true,
  enableTabSwitchDetection: true,
  enableCopyPasteDetection: true,
  enableDevToolsDetection: true,
  enableFocusDetection: true,
  enableContextMenuBlocking: true
};

export const useInvigilator = ({
  sessionId,
  socket,
  onViolation,
  config = {},
  isActive = true
}: UseInvigilatorProps) => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const lastViolationTime = useRef<Map<ViolationType, number>>(new Map());
  const isFullscreenActive = useRef(false);
  const devToolsCheckInterval = useRef<NodeJS.Timeout | null>(null);
  const windowSizeRef = useRef({ width: window.innerWidth, height: window.innerHeight });

  // Debounce function to prevent spam violations
  const isRecentViolation = (type: ViolationType, cooldownMs: number = 1000): boolean => {
    const now = Date.now();
    const lastTime = lastViolationTime.current.get(type) || 0;
    
    if (now - lastTime < cooldownMs) {
      return true;
    }
    
    lastViolationTime.current.set(type, now);
    return false;
  };

  // Report violation to server
  const reportViolation = useCallback((type: ViolationType, details?: any) => {
    if (!isActive || !socket || isRecentViolation(type)) return;

    const violation: ViolationEvent = {
      type,
      timestamp: new Date(),
      details
    };

    // Send to server via WebSocket
    socket.emit('violation-detected', {
      sessionId,
      violationType: type,
      timestamp: violation.timestamp,
      details
    });

    // Call local handler
    onViolation?.(violation);

  }, [sessionId, socket, onViolation, isActive]);

  // Fullscreen API functions
  const enterFullscreen = useCallback(async () => {
    if (!finalConfig.enableFullscreen) return;

    try {
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if ((elem as any).webkitRequestFullscreen) {
        await (elem as any).webkitRequestFullscreen();
      } else if ((elem as any).msRequestFullscreen) {
        await (elem as any).msRequestFullscreen();
      }
      isFullscreenActive.current = true;
    } catch (error) {
      console.error('Failed to enter fullscreen:', error);
    }
  }, [finalConfig.enableFullscreen]);

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        await (document as any).webkitExitFullscreen();
      } else if ((document as any).msExitFullscreen) {
        await (document as any).msExitFullscreen();
      }
      isFullscreenActive.current = false;
    } catch (error) {
      console.error('Failed to exit fullscreen:', error);
    }
  }, []);

  // Tab switching / visibility detection
  useEffect(() => {
    if (!finalConfig.enableTabSwitchDetection || !isActive) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        reportViolation(ViolationType.TAB_SWITCH, {
          hidden: true,
          visibilityState: document.visibilityState
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [finalConfig.enableTabSwitchDetection, isActive, reportViolation]);

  // Window focus detection
  useEffect(() => {
    if (!finalConfig.enableFocusDetection || !isActive) return;

    const handleBlur = () => {
      reportViolation(ViolationType.FOCUS_LOSS, {
        type: 'window_blur'
      });
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', () => {});

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', () => {});
    };
  }, [finalConfig.enableFocusDetection, isActive, reportViolation]);

  // Fullscreen exit detection
  useEffect(() => {
    if (!finalConfig.enableFullscreen || !isActive) return;

    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).msFullscreenElement
      );

      if (isFullscreenActive.current && !isCurrentlyFullscreen) {
        reportViolation(ViolationType.FULLSCREEN_EXIT, {
          exitedAt: new Date().toISOString()
        });
        
        // Auto re-enter fullscreen after a brief delay
        setTimeout(() => {
          enterFullscreen();
        }, 1000);
      }

      isFullscreenActive.current = isCurrentlyFullscreen;
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
    };
  }, [finalConfig.enableFullscreen, isActive, reportViolation, enterFullscreen]);

  // Copy/Paste detection
  useEffect(() => {
    if (!finalConfig.enableCopyPasteDetection || !isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Detect Ctrl+C, Ctrl+V, Ctrl+X
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'c' || e.key === 'v' || e.key === 'x') {
          e.preventDefault();
          reportViolation(ViolationType.COPY_PASTE, {
            key: e.key,
            action: e.key === 'c' ? 'copy' : e.key === 'v' ? 'paste' : 'cut'
          });
        }
      }

      // Detect F12 (Developer Tools)
      if (e.key === 'F12') {
        e.preventDefault();
        reportViolation(ViolationType.DEV_TOOLS, {
          key: 'F12'
        });
      }

      // Detect Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U
      if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
        if (e.key === 'I' || e.key === 'J' || e.key === 'C') {
          e.preventDefault();
          reportViolation(ViolationType.DEV_TOOLS, {
            key: `Ctrl+Shift+${e.key}`,
            action: 'developer_tools_shortcut'
          });
        }
      }

      // Detect Ctrl+U (View Source)
      if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
        e.preventDefault();
        reportViolation(ViolationType.DEV_TOOLS, {
          key: 'Ctrl+U',
          action: 'view_source'
        });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [finalConfig.enableCopyPasteDetection, isActive, reportViolation]);

  // Context menu blocking
  useEffect(() => {
    if (!finalConfig.enableContextMenuBlocking || !isActive) return;

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      reportViolation(ViolationType.CONTEXT_MENU, {
        x: e.clientX,
        y: e.clientY,
        target: (e.target as Element)?.tagName
      });
    };

    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, [finalConfig.enableContextMenuBlocking, isActive, reportViolation]);

  // Developer tools detection (window resize method)
  useEffect(() => {
    if (!finalConfig.enableDevToolsDetection || !isActive) return;

    const checkDevTools = () => {
      const threshold = 160;
      const widthDiff = Math.abs(window.outerWidth - window.innerWidth);
      const heightDiff = Math.abs(window.outerHeight - window.innerHeight);

      if (widthDiff > threshold || heightDiff > threshold) {
        const newSize = { width: window.innerWidth, height: window.innerHeight };
        const oldSize = windowSizeRef.current;
        
        const sizeChange = Math.abs(newSize.width - oldSize.width) + Math.abs(newSize.height - oldSize.height);
        
        if (sizeChange > 100) {
          reportViolation(ViolationType.DEV_TOOLS, {
            method: 'window_resize_detection',
            oldSize,
            newSize,
            widthDiff,
            heightDiff
          });
        }
        
        windowSizeRef.current = newSize;
      }
    };

    devToolsCheckInterval.current = setInterval(checkDevTools, 2000);
    window.addEventListener('resize', checkDevTools);

    return () => {
      if (devToolsCheckInterval.current) {
        clearInterval(devToolsCheckInterval.current);
      }
      window.removeEventListener('resize', checkDevTools);
    };
  }, [finalConfig.enableDevToolsDetection, isActive, reportViolation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (devToolsCheckInterval.current) {
        clearInterval(devToolsCheckInterval.current);
      }
    };
  }, []);

  return {
    enterFullscreen,
    exitFullscreen,
    isFullscreenActive: isFullscreenActive.current,
    reportViolation
  };
}; 