import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { useSidebar } from '../../context/SidebarContext';
import { 
  BarChart, 
  Home, 
  Award, 
  BookOpen, 
  UserPlus, 
  Plus,
  Code,
  Terminal,
  X,
  ChevronLeft,
  ChevronRight,
  FileUser,
  Briefcase
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { Button } from '../ui/button';

type NavItem = {
  title: string;
  href: string;
  icon: React.ReactNode;
  roles?: Array<'teacher' | 'student'>;
};

const Sidebar: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const { isCollapsed, isMobileOpen, closeMobileSidebar, toggleSidebar } = useSidebar();

  const navItems: NavItem[] = [
    {
      title: 'My Classes',
      href: '/classes',
      icon: <BookOpen className="h-4 w-4" />,
    },
    {
      title: 'Coding Tests',
      href: '/tests',
      icon: <Terminal className="h-4 w-4" />,
    },
    {
      title: 'Practice',
      href: '/practice',
      icon: <Code className="h-4 w-4" />,
    },
    {
      title: 'Join Class',
      href: '/join-class',
      icon: <UserPlus className="h-4 w-4" />,
      roles: ['student'],
    },
    {
      title: 'Leaderboard',
      href: '/leaderboard',
      icon: <Award className="h-4 w-4" />,
    },
    {
      title: 'Portfolio',
      href: '/portfolio/studio',
      icon: <FileUser className="h-4 w-4" />,
    },
    {
      title: 'Jobs',
      href: '/jobs',
      icon: <Briefcase className="h-4 w-4" />,
    },
  ];

  // Filter nav items based on user role
  const filteredNavItems = navItems.filter(
    (item) => !item.roles || item.roles.includes(user?.role.toLowerCase() as 'student' | 'teacher' || 'student')
  );

  const NavLink: React.FC<{ item: NavItem; isMobile?: boolean }> = ({ item, isMobile = false }) => {
    const isActive = location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);
    
    const handleClick = () => {
      if (isMobile) {
        closeMobileSidebar();
      }
    };
    
    const linkContent = (
          <Link
            to={item.href}
        onClick={handleClick}
            className={cn(
          'flex items-center rounded-md text-sm font-medium transition-all duration-200',
          isActive
            ? 'bg-primary/10 text-primary border-l-2 border-primary shadow-sm'
            : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground',
          isCollapsed && !isMobile 
            ? 'justify-center p-2 mx-1' // Smaller padding for collapsed state
            : 'gap-3 px-3 py-2' // Normal padding for expanded state
            )}
          >
        <span className={cn(
          "flex-shrink-0",
          isCollapsed && !isMobile && "w-4 h-4"
        )}>
            {item.icon}
        </span>
        {(!isCollapsed || isMobile) && (
          <span className="truncate transition-opacity duration-200">
            {item.title}
          </span>
        )}
          </Link>
    );

    if (isCollapsed && !isMobile) {
      return (
        <TooltipProvider>
          <Tooltip delayDuration={100}>
            <TooltipTrigger asChild>
              {linkContent}
            </TooltipTrigger>
            <TooltipContent side="right" className="ml-2">
              <p>{item.title}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return linkContent;
  };

  const ToggleButton: React.FC = () => {
    const toggleButton = (
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleSidebar}
        className={cn(
          'transition-all duration-200 hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground',
          isCollapsed 
            ? 'h-8 w-8 p-0' // Smaller for collapsed state
            : 'h-8 px-2' // Normal for expanded state
        )}
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
        {!isCollapsed && (
          <span className="ml-1 text-xs">Collapse</span>
        )}
      </Button>
    );

    if (isCollapsed) {
      return (
        <TooltipProvider>
          <Tooltip delayDuration={100}>
            <TooltipTrigger asChild>
              {toggleButton}
            </TooltipTrigger>
            <TooltipContent side="right" className="ml-2">
              <p>Expand sidebar</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return toggleButton;
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 dark:bg-black dark:bg-opacity-80 z-40 md:hidden"
          onClick={closeMobileSidebar}
        />
      )}

      {/* Desktop Sidebar */}
      <aside 
        className={cn(
          'shrink-0 border-r border-sidebar-border hidden md:block overflow-y-auto bg-sidebar transition-all duration-300 ease-in-out',
          isCollapsed ? 'w-12' : 'w-64'
        )}
      >
        <div className={cn(
          'flex flex-col h-full',
          isCollapsed ? 'p-1 py-2' : 'p-4'
        )}>
          {/* Toggle Button */}
          <div className={cn(
            'flex mb-2',
            isCollapsed ? 'justify-center' : 'justify-end'
          )}>
            <ToggleButton />
          </div>

          {/* Navigation */}
          <nav className="flex flex-col gap-1 flex-1">
            {filteredNavItems.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </nav>
        </div>
      </aside>

      {/* Mobile Sidebar */}
      <aside 
        className={cn(
          'fixed top-0 left-0 h-full w-64 bg-white dark:bg-black border-r border-gray-200 dark:border-gray-800 z-50 md:hidden transition-transform duration-300 ease-in-out',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          <span className="font-semibold text-lg">Menu</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={closeMobileSidebar}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <nav className="flex flex-col gap-1 p-4">
          {filteredNavItems.map((item) => (
            <NavLink key={`mobile-${item.href}`} item={item} isMobile />
        ))}
      </nav>
    </aside>
    </>
  );
};

export default Sidebar;
