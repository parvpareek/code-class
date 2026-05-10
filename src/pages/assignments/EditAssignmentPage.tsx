import React, { useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getAssignmentDetails, updateAssignment, extractProblemFromUrl, AssignmentUpdateData } from '../../api/assignments';
import { getClasses } from '../../api/classes';
import { Class } from '../../types';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PlusCircle, Trash2, Sparkles, Edit3, Check, X, FileText, ArrowRight, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import LoadingScreen from '@/components/ui/LoadingScreen';
import { Assignment } from '@/types';

const problemSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  url: z.string().url('Must be a valid URL'),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']),
});

const assignmentSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  classId: z.string().min(1, 'You must select a class'),
  assignDate: z.string(),
  dueDate: z.string(),
  problems: z.array(problemSchema).min(1, 'At least one problem is required'),
});

type FormValues = z.infer<typeof assignmentSchema>;

// Problem Card Component for reviewing extracted problems
const ProblemCard = ({ 
  problem, 
  index, 
  onEdit, 
  onSave, 
  onCancel, 
  onRemove 
}: {
  problem: {
    title: string;
    url: string;
    difficulty: 'Easy' | 'Medium' | 'Hard';
    status: 'success' | 'failed' | 'edited';
    originalTitle?: string;
    isEditing?: boolean;
  };
  index: number;
  onEdit: () => void;
  onSave: (title: string, difficulty: 'Easy' | 'Medium' | 'Hard') => void;
  onCancel: () => void;
  onRemove: () => void;
}) => {
  const [editTitle, setEditTitle] = useState(problem.title);
  const [editDifficulty, setEditDifficulty] = useState(problem.difficulty);

  const getBorderColor = () => {
    switch (problem.status) {
      case 'success': return 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950';
      case 'failed': return 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950';
      case 'edited': return 'border-blue-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900';
      default: return '';
    }
  };

  const getStatusBadge = () => {
    switch (problem.status) {
      case 'success':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            <Check className="w-3 h-3 mr-1" />
            Auto-extracted
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
            <X className="w-3 h-3 mr-1" />
            Extraction failed
          </span>
        );
      case 'edited':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
            <Edit3 className="w-3 h-3 mr-1" />
            Manually edited
          </span>
        );
    }
  };

  return (
    <div className={`p-4 border rounded-lg relative ${getBorderColor()}`}>
      {/* Status Badge */}
      <div className="absolute top-3 left-3">
        {getStatusBadge()}
      </div>

      {/* Remove Button */}
      <Button
        type="button"
        variant="destructive"
        size="sm"
        onClick={onRemove}
        className="absolute top-3 right-3 h-8 w-8 p-0"
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      <div className="pt-8 space-y-4">
        {/* Problem Title */}
        <div>
          <label className="block text-sm font-medium mb-2">Problem Title</label>
          {problem.isEditing ? (
            <div className="flex gap-2">
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="flex-1"
                placeholder="Enter problem title"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onSave(editTitle, editDifficulty)}
                disabled={!editTitle.trim()}
                className="px-3"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCancel}
                className="px-3"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                value={problem.title}
                readOnly
                className="flex-1 bg-gray-50 dark:bg-black"
              />
              {problem.status !== 'failed' && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onEdit}
                  className="px-3"
                >
                  <Edit3 className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Problem URL */}
        <div>
          <label className="block text-sm font-medium mb-2">Problem URL</label>
          <Input
            value={problem.url}
            readOnly
            className="bg-gray-50 dark:bg-black font-mono text-xs"
          />
        </div>

        {/* Difficulty */}
        <div>
          <label className="block text-sm font-medium mb-2">Difficulty</label>
          {problem.isEditing ? (
            <Select value={editDifficulty} onValueChange={(value: 'Easy' | 'Medium' | 'Hard') => setEditDifficulty(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Easy">Easy</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <div className="flex items-center gap-2">
              <div className={`px-3 py-2 rounded-md text-sm font-medium border
                ${problem.difficulty === 'Easy' ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200' : 
                  problem.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-200' : 
                  'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200'}`}
              >
                {problem.difficulty}
              </div>
              {problem.status === 'success' && (
                <span className="text-xs text-gray-500">Auto-detected</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const EditAssignmentPage = () => {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [teacherClasses, setTeacherClasses] = useState<Class[]>([]);
  const [extractingAllTitles, setExtractingAllTitles] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState<{
    current: number;
    total: number;
    currentUrl: string;
  } | null>(null);
  const [bulkUrls, setBulkUrls] = useState('');
  const [extractedProblems, setExtractedProblems] = useState<Array<{
    title: string;
    url: string;
    difficulty: 'Easy' | 'Medium' | 'Hard';
    status: 'success' | 'failed' | 'edited';
    originalTitle?: string;
    isEditing?: boolean;
  }>>([]);
  const [showBulkInput, setShowBulkInput] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: {
      title: '',
      description: '',
      classId: '',
      assignDate: '',
      dueDate: '',
      problems: [{ title: '', url: '', difficulty: 'Easy' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'problems',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [assignment, classesResponse] = await Promise.all([
          getAssignmentDetails(assignmentId!),
          getClasses(),
        ]);

        setTeacherClasses(classesResponse.classes);

        // Convert assignment dates to the format expected by the form
        const assignDate = assignment.assignDate 
          ? new Date(assignment.assignDate).toISOString().split('T')[0]
          : '';
        const dueDate = assignment.dueDate
          ? new Date(assignment.dueDate).toISOString().split('T')[0]
          : '';

        form.reset({
          title: assignment.title,
          description: assignment.description || '',
          classId: assignment.classId.toString(),
          assignDate,
          dueDate,
          problems: assignment.problems || [{ title: '', url: '', difficulty: 'Easy' }],
        });
      } catch (error) {
        console.error('Error fetching assignment:', error);
        toast({ title: 'Failed to load assignment details', variant: 'destructive' });
        navigate('/dashboard');
      } finally {
        setIsLoading(false);
      }
    };

    if (assignmentId) {
      fetchData();
    }
  }, [assignmentId, form, navigate]);

  const onSubmit = async (data: FormValues) => {
    try {
      await updateAssignment(assignmentId!, {
        title: data.title,
        description: data.description,
        assignDate: new Date(data.assignDate),
        dueDate: new Date(data.dueDate),
        problems: data.problems.map(p => ({
          title: p.title,
          url: p.url,
          difficulty: p.difficulty
        })),
      });

      toast({ title: 'Assignment updated successfully!' });
      navigate(`/assignments/${assignmentId}`);
    } catch (error) {
      console.error('Error updating assignment:', error);
      toast({ title: 'Failed to update assignment', variant: 'destructive' });
    }
  };

  const extractFromBulkUrls = async () => {
    const urls = bulkUrls
      .split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0);
    
    if (urls.length === 0) {
      toast({ title: 'Please paste some URLs first (one per line)', variant: 'destructive' });
      return;
    }

    // Validate URLs
    const invalidUrls = urls.filter(url => {
      try {
        new URL(url);
        return false;
      } catch {
        return true;
      }
    });

    if (invalidUrls.length > 0) {
      toast({
        title: `Invalid URLs found: ${invalidUrls.slice(0, 3).join(', ')}${invalidUrls.length > 3 ? '...' : ''}`,
        variant: 'destructive',
      });
      return;
    }

    setExtractingAllTitles(true);
    setExtractionProgress({ current: 0, total: urls.length, currentUrl: '' });
    
    const problems: typeof extractedProblems = [];

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      
      setExtractionProgress({ 
        current: i + 1, 
        total: urls.length, 
        currentUrl: url 
      });

      try {
        const problemDetails = await extractProblemFromUrl(url);
        
        problems.push({
          title: problemDetails.title,
          url: url,
          difficulty: (problemDetails.difficulty || 'Easy') as 'Easy' | 'Medium' | 'Hard',
          status: 'success',
          originalTitle: problemDetails.title
        });
      } catch (error) {
        console.error(`Error extracting title for ${url}:`, error);
        
        // Create a fallback title from URL
        const fallbackTitle = url
          .split('/').pop()?.replace(/[-_]/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown Problem';
        
        problems.push({
          title: fallbackTitle,
          url: url,
          difficulty: 'Easy',
          status: 'failed',
          isEditing: true
        });
      }
      
      // Small delay to avoid overwhelming the APIs
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setExtractedProblems(problems);
    setExtractingAllTitles(false);
    setExtractionProgress(null);

    // Show summary toast
    const successCount = problems.filter(p => p.status === 'success').length;
    const failedCount = problems.filter(p => p.status === 'failed').length;
    
    if (successCount > 0 && failedCount === 0) {
      toast({
        title: `🎉 Successfully extracted ${successCount} problems! Review and update assignment.`,
      });
    } else if (successCount > 0 && failedCount > 0) {
      toast({
        title: `📊 Extracted ${successCount} problems, ${failedCount} failed. Please edit the failed ones.`,
      });
    } else {
      toast({
        title: '❌ Could not extract any problem titles. Please edit them manually.',
        variant: 'destructive',
      });
    }
  };

  const editProblem = (index: number) => {
    setExtractedProblems(prev => prev.map((p, i) => 
      i === index ? { ...p, isEditing: true } : p
    ));
  };

  const saveProblemEdit = (index: number, newTitle: string, newDifficulty: 'Easy' | 'Medium' | 'Hard') => {
    setExtractedProblems(prev => prev.map((p, i) => 
      i === index ? { 
        ...p, 
        title: newTitle, 
        difficulty: newDifficulty,
        status: 'edited',
        isEditing: false 
      } : p
    ));

    toast({ title: 'Problem updated!' });
  };

  const cancelProblemEdit = (index: number) => {
    setExtractedProblems(prev => prev.map((p, i) => 
      i === index ? { ...p, isEditing: false } : p
    ));
  };

  const removeProblem = (index: number) => {
    setExtractedProblems(prev => prev.filter((_, i) => i !== index));
  };

  const applyExtractedProblems = () => {
    form.setValue('problems', extractedProblems.map(p => ({
      title: p.title,
      url: p.url,
      difficulty: p.difficulty
    })));
    setShowBulkInput(false);
    setExtractedProblems([]);
    setBulkUrls('');
    toast({ title: 'Problems added to assignment!' });
  };

  // Handle back navigation
  const handleBack = () => {
    // Go back to assignment details
    navigate(`/assignments/${assignmentId}`);
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Back Button Header */}
      <div className="mb-6">
        <Button
          variant="outline"
          onClick={handleBack}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Assignment
        </Button>
        <h1 className="text-2xl font-bold">Edit Assignment</h1>
        <p className="text-gray-600">Update your assignment details</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Assignment Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assignment Title</FormLabel>
                      <FormControl>
                      <Input placeholder="e.g., Data Structures Practice" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                        placeholder="Brief description of the assignment..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

              <FormField
                control={form.control}
                name="classId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Class</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a class" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {teacherClasses.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id.toString()}>
                            {cls.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="assignDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assign Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Due Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
              </div>

              {/* Problems Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Problems</h3>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowBulkInput(true)}
                      className="flex items-center gap-2"
                    >
                      <FileText className="h-4 w-4" />
                      Bulk Import URLs
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => append({ title: '', url: '', difficulty: 'Easy' })}
                    >
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Add Problem
                    </Button>
                  </div>
                </div>

                {/* Bulk URL Input Modal/Overlay */}
                {showBulkInput && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-black rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">Bulk Import Problem URLs</h3>
                        <Button
                          variant="ghost"
                          onClick={() => setShowBulkInput(false)}
                          className="h-8 w-8 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      {!extractedProblems.length ? (
                        <div className="space-y-4">
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Paste multiple problem URLs (one per line) and we'll extract titles and difficulties automatically
                          </p>
                          
                          <Textarea
                            placeholder={`https://leetcode.com/problems/two-sum/
https://www.geeksforgeeks.org/problems/reverse-a-linked-list/0
https://www.hackerrank.com/challenges/simple-array-sum/
https://codeforces.com/problemset/problem/1/A`}
                            value={bulkUrls}
                            onChange={(e) => setBulkUrls(e.target.value)}
                            className="min-h-32 font-mono text-sm"
                            disabled={extractingAllTitles}
                          />
                          
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500">
                              {bulkUrls.split('\n').filter(url => url.trim()).length} URLs detected
                            </span>
                            
                            <Button
                              type="button"
                              onClick={extractFromBulkUrls}
                              disabled={extractingAllTitles || !bulkUrls.trim()}
                              className="flex items-center gap-2"
                            >
                              {extractingAllTitles ? (
                                <>
                                  <div className="animate-spin h-4 w-4 border border-current border-t-transparent rounded-full" />
                                  Extracting...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="h-4 w-4" />
                                  Extract All Problems
                                  <ArrowRight className="h-4 w-4" />
                                </>
                              )}
                            </Button>
                          </div>

                          {extractionProgress && (
                            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border">
                              <div className="flex items-center justify-between text-sm mb-2">
                                <span className="font-medium">Extracting problem details...</span>
                                <span className="text-blue-600 dark:text-blue-400">
                                  {extractionProgress.current}/{extractionProgress.total}
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 dark:bg-blue-800 rounded-full h-2 mb-2">
                                <div 
                                  className="bg-gray-600 h-2 rounded-full transition-all duration-300" 
                                  style={{ width: `${(extractionProgress.current / extractionProgress.total) * 100}%` }}
                                />
                              </div>
                              <p className="text-xs text-blue-600 dark:text-blue-400 truncate">
                                Currently processing: {extractionProgress.currentUrl}
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                            <div className="flex items-center gap-2">
                              <Check className="h-5 w-5 text-green-600" />
                              <span className="font-medium text-green-800 dark:text-green-200">
                                {extractedProblems.length} problems extracted and ready for review
                              </span>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setExtractedProblems([]);
                                  setBulkUrls('');
                                }}
                                className="text-sm"
                              >
                                Start Over
                              </Button>
                              <Button
                                onClick={applyExtractedProblems}
                                className="text-sm"
                              >
                                Add to Assignment
                              </Button>
                            </div>
                          </div>

                          <div className="space-y-3 max-h-96 overflow-y-auto">
                            {extractedProblems.map((problem, index) => (
                              <ProblemCard
                                key={index}
                                problem={problem}
                                index={index}
                                onEdit={() => editProblem(index)}
                                onSave={(title, difficulty) => saveProblemEdit(index, title, difficulty)}
                                onCancel={() => cancelProblemEdit(index)}
                                onRemove={() => removeProblem(index)}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Regular Problem Fields */}
                <div className="space-y-6">
                  {fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="p-4 border rounded-md relative space-y-4"
                    >
                      <FormField
                        control={form.control}
                        name={`problems.${index}.title`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Problem Title</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., Two Sum" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name={`problems.${index}.url`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Problem URL</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="https://leetcode.com/problems/two-sum/"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name={`problems.${index}.difficulty`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Difficulty</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select difficulty" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Easy">Easy</SelectItem>
                                <SelectItem value="Medium">Medium</SelectItem>
                                <SelectItem value="Hard">Hard</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => remove(index)}
                        className="absolute top-2 right-2"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                >
                  Cancel
                </Button>
                <Button type="submit">Update Assignment</Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default EditAssignmentPage; 
