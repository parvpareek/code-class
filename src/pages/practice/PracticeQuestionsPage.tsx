import React, { useState, useEffect, useMemo } from 'react';
import { DSASheet, DSAQuestion, DSATopic, DSAStats } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { 
  loadDSASheet,
  groupQuestionsByTopic,
  calculateDSAStats,
  getDifficultyColor,
  filterQuestions,
  getRandomQuestion
} from '../../utils/dsaSheetParser';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { Card } from '../../components/ui/card';
import { Checkbox } from '../../components/ui/checkbox';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../components/ui/accordion';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import LoadingScreen from '../../components/ui/LoadingScreen';
import NotesDialog from '../../components/dsa/NotesDialog';
import { Search, ExternalLink, Shuffle, ChevronDown, Youtube } from 'lucide-react';

// Progress Item Interface
interface ProgressItem {
  isCompleted: boolean;
  isRevision: boolean;
  notes?: string;
  completedAt?: string;
  questionId: string;
  updatedAt?: string;
}

// Platform Logo Component
const PlatformLogo: React.FC<{ platform: string; className?: string }> = ({ platform, className = "w-5 h-5" }) => {
  const getPlatformComponent = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'leetcode':
        return (
          <img 
            src="/leetcode.svg" 
            alt="LeetCode" 
            className={`${className} object-contain`}
            title="LeetCode"
          />
        );
      case 'geeksforgeeks':
        return (
          <img 
            src="/icons8-geeksforgeeks-48.png" 
            alt="GeeksforGeeks" 
            className={`${className} object-contain`}
            title="GeeksforGeeks"
          />
        );
      case 'tuf':
      case 'takeuforward':
        return (
          <img 
            src="/tuf.png" 
            alt="TakeUForward" 
            className={`${className} object-contain`}
            title="TakeUForward"
          />
        );
      case 'codeforces':
        return (
          <div className={`${className} bg-blue-600 text-white rounded-sm flex items-center justify-center font-bold text-xs`}>
            CF
          </div>
        );
      case 'codechef':
        return (
          <div className={`${className} bg-yellow-600 text-white rounded-sm flex items-center justify-center font-bold text-xs`}>
            CC
          </div>
        );
      case 'hackerrank':
        return (
          <div className={`${className} bg-green-500 text-white rounded-sm flex items-center justify-center font-bold text-xs`}>
            HR
          </div>
        );
      default:
        return (
          <div className={`${className} bg-gray-500 text-white rounded-sm flex items-center justify-center font-bold text-xs`}>
            {platform.charAt(0).toUpperCase()}
          </div>
        );
    }
  };

  return getPlatformComponent(platform);
};

// Function to extract human-readable title from URL
const extractTitleFromUrl = (url: string): string => {
  try {
    // Extract the last part of the URL path
    const urlObj = new URL(url);
    const pathSegments = urlObj.pathname.split('/').filter(segment => segment.length > 0);
    const lastSegment = pathSegments[pathSegments.length - 1];
    
    if (!lastSegment) return 'Problem';
    
    // Remove common suffixes and clean up
    let title = lastSegment
      .replace(/\/$/, '') // Remove trailing slash
      .replace(/\?.*$/, '') // Remove query parameters
      .replace(/\.html?$/, '') // Remove .html extension
      .replace(/\d+$/, '') // Remove trailing numbers only if at the end
      .replace(/[-_]/g, ' ') // Replace hyphens and underscores with spaces
      .trim();
    
    // Handle specific patterns for different platforms
    if (url.includes('leetcode.com')) {
      // LeetCode URLs: remove common prefixes/suffixes
      title = title.replace(/^(problem-)?/, '').replace(/(-\d+)?$/, '');
    } else if (url.includes('geeksforgeeks.org')) {
      // GeeksforGeeks URLs: extract from problems path
      if (title.includes('problems')) {
        const problemIndex = title.toLowerCase().indexOf('problems');
        title = title.substring(problemIndex + 8).trim();
      }
      // Remove GFG-specific suffixes
      title = title.replace(/\d+$/, '').replace(/^gfg-/, '');
    }
    
    // Final cleanup and capitalization
    title = title
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\b\w/g, (match) => match.toUpperCase()) // Capitalize first letter of each word
      .trim();
    
    // Ensure title is not empty and has minimum length
    return title && title.length > 1 ? title : 'Problem';
  } catch (error) {
    return 'Problem';
  }
};

// Function to get display title
const getDisplayTitle = (question: DSAQuestion): string => {
  // If title exists and is not empty, use it
  if (question.title && question.title.trim()) {
    return question.title;
  }
  
  // If name exists and is not empty, use it
  if (question.name && question.name.trim()) {
    return question.name;
  }
  
  // Otherwise, extract from URL
  if (question.problem_url) {
    return extractTitleFromUrl(question.problem_url);
  }
  
  return 'Untitled Problem';
};

// Local Storage Helper Functions
const saveProgressToLocalStorage = (progress: Record<string, ProgressItem>) => {
  try {
    localStorage.setItem('dsaProgress', JSON.stringify(progress));
  } catch (error) {
    console.error('Failed to save progress to localStorage:', error);
  }
};

const loadProgressFromLocalStorage = (): Record<string, ProgressItem> => {
  try {
    const stored = localStorage.getItem('dsaProgress');
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Failed to load progress from localStorage:', error);
    return {};
  }
};

const PracticeQuestionsPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [dsaSheet, setDsaSheet] = useState<DSASheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [showRevisionOnly, setShowRevisionOnly] = useState(false);
  const [expandedTopic, setExpandedTopic] = useState<string>('');
  
  // Progress tracking state
  const [userProgress, setUserProgress] = useState<Record<string, ProgressItem>>({});
  
  // Notes dialog state
  const [notesDialog, setNotesDialog] = useState<{
    isOpen: boolean;
    question: DSAQuestion | null;
    currentNotes: string;
  }>({
    isOpen: false,
    question: null,
    currentNotes: ''
  });

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Load DSA sheet data
        const dsaData = await loadDSASheet();

        // Load user progress from localStorage
        const progressData = { progress: loadProgressFromLocalStorage() };

        setDsaSheet(dsaData);
        setUserProgress(progressData.progress || {});
      } catch {
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const stats = useMemo(() => {
    if (!dsaSheet) return null;
    
    // Calculate stats with actual user progress
    const questionsWithProgress = dsaSheet.questions.map(q => ({
      ...q,
      is_solved: userProgress[q.mapping_id]?.isCompleted || false
    }));
    
    return calculateDSAStats(questionsWithProgress);
  }, [dsaSheet, userProgress]);

  const topics = useMemo(() => {
    if (!dsaSheet) return [];
    
    // Add user progress to questions
    const questionsWithProgress = dsaSheet.questions.map(q => ({
      ...q,
      is_solved: userProgress[q.mapping_id]?.isCompleted || false
    }));
    
    return groupQuestionsByTopic(questionsWithProgress);
  }, [dsaSheet, userProgress]);

  const filteredQuestions = useMemo(() => {
    if (!dsaSheet) return [];
    return filterQuestions(
      dsaSheet.questions,
      searchTerm,
      selectedDifficulty,
      showRevisionOnly
    );
  }, [dsaSheet, searchTerm, selectedDifficulty, showRevisionOnly]);

  const handleRandomQuestion = () => {
    if (!dsaSheet) return;
    const randomQuestion = getRandomQuestion(dsaSheet.questions);
    if (randomQuestion) {
      window.open(randomQuestion.problem_url, '_blank');
    }
  };

  // Handle question completion toggle
  const handleToggleCompletion = async (questionId: string, isCompleted: boolean) => {
    try {
      // Update local state
      const newProgress = {
        ...userProgress,
        [questionId]: {
          ...userProgress[questionId],
          isCompleted,
          completedAt: isCompleted ? new Date().toISOString() : '',
          isRevision: userProgress[questionId]?.isRevision || false,
          notes: userProgress[questionId]?.notes || '',
          questionId,
          updatedAt: new Date().toISOString()
        }
      };
      
      setUserProgress(newProgress);
      
      // Save to localStorage
      saveProgressToLocalStorage(newProgress);
    } catch {
      alert('Failed to update completion status.');
    }
  };

  // Handle revision toggle
  const handleToggleRevision = async (questionId: string, isRevision: boolean) => {
    try {
      // Update local state
      const newProgress = {
        ...userProgress,
        [questionId]: {
          ...userProgress[questionId],
          isRevision,
          isCompleted: userProgress[questionId]?.isCompleted || false,
          completedAt: userProgress[questionId]?.completedAt || '',
          notes: userProgress[questionId]?.notes || '',
          questionId,
          updatedAt: new Date().toISOString()
        }
      };
      
      setUserProgress(newProgress);
      
      // Save to localStorage
      saveProgressToLocalStorage(newProgress);
    } catch {
      alert('Failed to update revision status.');
    }
  };

  // Handle opening notes dialog
  const handleOpenNotes = (question: DSAQuestion) => {
    const currentNotes = userProgress[question.mapping_id]?.notes || '';
    setNotesDialog({
      isOpen: true,
      question,
      currentNotes
    });
  };

  // Handle saving notes
  const handleSaveNotes = (notes: string) => {
    if (!notesDialog.question) return;
    
    const questionId = notesDialog.question.mapping_id;
    const newProgress = {
      ...userProgress,
      [questionId]: {
        ...userProgress[questionId],
        notes,
        isCompleted: userProgress[questionId]?.isCompleted || false,
        isRevision: userProgress[questionId]?.isRevision || false,
        completedAt: userProgress[questionId]?.completedAt || '',
        questionId,
        updatedAt: new Date().toISOString()
      }
    };
    
    setUserProgress(newProgress);
    
    // Save to localStorage
    saveProgressToLocalStorage(newProgress);
  };
  
  if (loading) {
    return <LoadingScreen />;
  }

  if (!dsaSheet || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Failed to load DSA sheet data</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header with Progress */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          {/* Progress Overview */}
          <div className="flex items-center gap-8">
            <div className="text-center">
              <h2 className="text-lg font-medium text-muted-foreground mb-2">Total Progress</h2>
              <div className="text-3xl font-bold mb-1">
                {stats.completed_questions} / {stats.total_questions}
              </div>
              <div className="relative w-24 h-24 mx-auto">
                <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-muted stroke-current"
                    strokeWidth="3"
                    fill="none"
                    d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831
                      a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-orange-500 stroke-current"
                    strokeWidth="3"
                    strokeLinecap="round"
                    fill="none"
                    strokeDasharray={`${stats.overall_progress}, 100`}
                    d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831
                      a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold">{Math.round(stats.overall_progress)}%</span>
                </div>
              </div>
            </div>

            <div className="flex gap-6">
              <div className="text-center">
                <h3 className="text-base font-medium text-muted-foreground mb-2">Easy</h3>
                <div className="text-xl font-bold mb-2">
                  <span className="text-green-400">{stats.easy_completed}</span> / {stats.easy_total} <span className="text-muted-foreground text-sm">completed</span>
                </div>
                <div className="w-32 h-2 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500 transition-all"
                    style={{ width: `${stats.easy_total > 0 ? (stats.easy_completed / stats.easy_total) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div className="text-center">
                <h3 className="text-base font-medium text-muted-foreground mb-2">Medium</h3>
                <div className="text-xl font-bold mb-2">
                  <span className="text-orange-400">{stats.medium_completed}</span> / {stats.medium_total} <span className="text-muted-foreground text-sm">completed</span>
                </div>
                <div className="w-32 h-2 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-orange-500 transition-all"
                    style={{ width: `${stats.medium_total > 0 ? (stats.medium_completed / stats.medium_total) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div className="text-center">
                <h3 className="text-base font-medium text-muted-foreground mb-2">Hard</h3>
                <div className="text-xl font-bold mb-2">
                  <span className="text-red-400">{stats.hard_completed}</span> / {stats.hard_total} <span className="text-muted-foreground text-sm">completed</span>
                </div>
                <div className="w-32 h-2 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-red-500 transition-all"
                    style={{ width: `${stats.hard_total > 0 ? (stats.hard_completed / stats.hard_total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <Button 
            variant={!showRevisionOnly ? "default" : "outline"}
            onClick={() => setShowRevisionOnly(false)}
            className="rounded-full"
          >
            All Problems
          </Button>
          <Button 
            variant={showRevisionOnly ? "default" : "outline"}
            onClick={() => setShowRevisionOnly(true)}
            className="rounded-full"
          >
            Revision
          </Button>

          <div className="relative ml-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64 rounded-full bg-muted"
            />
          </div>

          <Select value={selectedDifficulty} onValueChange={setSelectedDifficulty}>
            <SelectTrigger className="w-32 rounded-full">
              <SelectValue placeholder="Difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Difficulty</SelectItem>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>

          <Button 
            variant="outline" 
            onClick={handleRandomQuestion}
            className="rounded-full flex items-center gap-2"
          >
            <Shuffle className="h-4 w-4" />
            Pick Random
          </Button>
        </div>
      </div>

      {/* Topics */}
      <div className="space-y-4">
        {topics.map((topic, index) => (
          <Card key={topic.name} className="border border-border bg-card">
            <Accordion type="single" collapsible value={expandedTopic} onValueChange={setExpandedTopic}>
              <AccordionItem value={`step${index + 1}`} className="border-none">
                <AccordionTrigger className="px-6 py-4 hover:no-underline">
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-4">
                      <ChevronDown className="h-4 w-4" />
                      <div className="text-left">
                        <h3 className="text-lg font-semibold">
                          Step {index + 1}: {topic.name}
                        </h3>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mr-6">
                      <div className="text-right">
                        <div className="text-2xl font-bold text-orange-400">
                          {topic.completed_questions} / {topic.total_questions}
                        </div>
                      </div>
                      <div className="w-64 h-2 bg-secondary rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-orange-500 transition-all"
                          style={{ width: `${topic.progress_percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-4">
                  {topic.sub_topics.map((subTopic) => (
                    <div key={subTopic.name} className="mb-6">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-base font-medium">{subTopic.name}</h4>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            {subTopic.completed_questions} / {subTopic.total_questions}
                          </span>
                        </div>
                      </div>

                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">Status</TableHead>
                            <TableHead>Problem</TableHead>
                            <TableHead className="w-24">Resource (Free)</TableHead>
                            <TableHead className="w-24">Practice</TableHead>
                            <TableHead className="w-20">Note</TableHead>
                            <TableHead className="w-20">Difficulty</TableHead>
                            <TableHead className="w-20">Revision</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {subTopic.questions
                            .filter(question => {
                              const displayTitle = getDisplayTitle(question);
                              const progress = userProgress[question.mapping_id];
                              const isCompleted = progress?.isCompleted || false;
                              const isRevision = progress?.isRevision || false;
                              
                              const matchesSearch = !searchTerm || 
                                displayTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                question.topic.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                question.sub_topic.toLowerCase().includes(searchTerm.toLowerCase());
                              const matchesDifficulty = selectedDifficulty === 'all' || 
                                question.difficulty.toLowerCase() === selectedDifficulty.toLowerCase();
                              const matchesRevision = !showRevisionOnly || isRevision;
                              return matchesSearch && matchesDifficulty && matchesRevision;
                            })
                            .map((question) => {
                              const progress = userProgress[question.mapping_id];
                              const isCompleted = progress?.isCompleted || false;
                              const isRevision = progress?.isRevision || false;
                              const hasNotes = progress?.notes && progress.notes.trim();
                              
                              return (
                                <TableRow key={question.question_id}>
                                  <TableCell>
                                    <Checkbox 
                                      checked={isCompleted}
                                      onCheckedChange={(checked) => 
                                        handleToggleCompletion(question.mapping_id, !!checked)
                                      }
                                      className="data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                                    />
                                  </TableCell>
                                  <TableCell className="font-medium">
                                    <span className="text-foreground">
                                      {getDisplayTitle(question)}
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    {question.resource ? (
                                      <a 
                                        href={question.resource} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-red-500 hover:text-red-400 inline-flex items-center gap-1"
                                        title="Watch Striver's Video"
                                      >
                                        <Youtube className="h-4 w-4" />
                                      </a>
                                    ) : (
                                      <span className="text-muted-foreground">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {question.problem_url ? (
                                      <a
                                        href={question.problem_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 hover:opacity-80"
                                        title={`Solve on ${question.platform}`}
                                      >
                                        <PlatformLogo platform={question.platform} />
                                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                                      </a>
                                    ) : (
                                      <span className="text-muted-foreground">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Button 
                                      size="sm" 
                                      variant="ghost" 
                                      className={`${hasNotes ? 'text-blue-500 hover:text-blue-400' : 'text-muted-foreground hover:text-foreground'}`}
                                      onClick={() => handleOpenNotes(question)}
                                    >
                                      {hasNotes ? '📝' : '+'}
                                    </Button>
                                  </TableCell>
                                  <TableCell>
                                    <Badge 
                                      variant="outline" 
                                      className={`${getDifficultyColor(question.difficulty)} border-current`}
                                    >
                                      {question.difficulty === 'Basic' ? 'Easy' : question.difficulty}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Button 
                                      size="sm" 
                                      variant="ghost" 
                                      className={`${isRevision ? 'text-orange-400' : 'text-muted-foreground'} hover:text-orange-400`}
                                      onClick={() => handleToggleRevision(question.mapping_id, !isRevision)}
                                    >
                                      ⭐
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                        </TableBody>
                      </Table>
                    </div>
                  ))}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Card>
        ))}
      </div>
      
      {/* Notes Dialog */}
      <NotesDialog
        question={notesDialog.question}
        isOpen={notesDialog.isOpen}
        onClose={() => setNotesDialog({ isOpen: false, question: null, currentNotes: '' })}
        initialNotes={notesDialog.currentNotes}
        onSave={handleSaveNotes}
      />
    </div>
  );
};

export default PracticeQuestionsPage;
