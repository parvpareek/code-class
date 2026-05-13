
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { LeaderboardEntry } from '../../types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Award, ChevronDown, ChevronUp, Code, Trophy, Info } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  /** When set, student names link to class peer profile (same class as leaderboard filter). */
  peerNavigation?: { classId: string } | null;
}

type SortKey = 'rank' | 'name' | 'completedCount' | 'avgSubmissionTime';
type SortDirection = 'asc' | 'desc';

const LeaderboardTable: React.FC<LeaderboardTableProps> = ({ entries, peerNavigation }) => {
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const sortedEntries = [...entries].sort((a, b) => {
    if (sortKey === 'name') {
      return sortDirection === 'asc' 
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name);
    }
    
    if (sortKey === 'avgSubmissionTime') {
      // Convert time strings to minutes for comparison
      const timeToMinutes = (timeStr: string) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
      };
      
      const aTime = timeToMinutes(a.avgSubmissionTime);
      const bTime = timeToMinutes(b.avgSubmissionTime);
      
      return sortDirection === 'asc' ? aTime - bTime : bTime - aTime;
    }
    
    // For numeric values
    return sortDirection === 'asc' 
      ? a[sortKey] - b[sortKey]
      : b[sortKey] - a[sortKey];
  });

  const SortIcon = ({ active }: { active: boolean }) => {
    return sortDirection === 'asc' ? (
      <ChevronUp className={cn("h-4 w-4 ml-1", active ? "opacity-100" : "opacity-0")} />
    ) : (
      <ChevronDown className={cn("h-4 w-4 ml-1", active ? "opacity-100" : "opacity-0")} />
    );
  };

  const getMedalColor = (rank: number) => {
    switch(rank) {
      case 1: return "text-yellow-500 dark:text-yellow-400";
      case 2: return "text-gray-400 dark:text-gray-300";
      case 3: return "text-amber-700 dark:text-amber-500";
      default: return "text-gray-600 dark:text-gray-400";
    }
  };

  if (entries.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No leaderboard data available</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-16">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => handleSort('rank')}
              className="font-medium flex items-center -ml-3"
            >
              Rank
              <SortIcon active={sortKey === 'rank'} />
            </Button>
          </TableHead>
          <TableHead>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => handleSort('name')}
              className="font-medium flex items-center -ml-3"
            >
              Student
              <SortIcon active={sortKey === 'name'} />
            </Button>
          </TableHead>
          <TableHead>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => handleSort('completedCount')}
              className="font-medium flex items-center -ml-3"
            >
              Assignments
              <SortIcon active={sortKey === 'completedCount'} />
            </Button>
          </TableHead>
          <TableHead>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => handleSort('avgSubmissionTime')}
              className="font-medium flex items-center -ml-3"
            >
              Avg. Speed
              <SortIcon active={sortKey === 'avgSubmissionTime'} />
            </Button>
          </TableHead>
          <TableHead className="text-center">
            <div className="flex items-center justify-center">
              <Code className="h-4 w-4 mr-1 text-orange-500 dark:text-orange-400" />
              LeetCode
            </div>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedEntries.map((entry) => (
          <TableRow key={entry.id ?? `r${entry.rank}-${entry.name}`} className={entry.rank <= 3 ? "bg-yellow-50 dark:bg-yellow-900/20" : ""}>
            <TableCell className="font-medium">
              <div className="flex items-center">
                {entry.rank <= 3 ? (
                  <Award className={`h-5 w-5 mr-1 ${getMedalColor(entry.rank)}`} />
                ) : (
                  entry.rank
                )}
              </div>
            </TableCell>
            <TableCell>
              <div>
                <div className="font-medium flex items-center gap-2">
                  {peerNavigation?.classId && entry.id ? (
                    <Link
                      to={`/classes/${peerNavigation.classId}/peers/${entry.id}`}
                      className="hover:underline text-primary"
                    >
                      {entry.name}
                    </Link>
                  ) : (
                    <span>{entry.name}</span>
                  )}
                  {entry.isSelf && (
                    <span className="text-xs text-muted-foreground font-normal">(You)</span>
                  )}
                  {typeof (entry as { lateCount?: number }).lateCount === 'number' && (entry as { lateCount?: number }).lateCount! > 0 && (
                    <span className="text-xs text-orange-600" title={`Late ${ (entry as any).lateCount }`}>
                      (Late {(entry as any).lateCount})
                    </span>
                  )}
                </div>
                {entry.leetcodeUsername && (
                  <div className="text-sm text-muted-foreground">
                    @{entry.leetcodeUsername}
                  </div>
                )}
              </div>
            </TableCell>
            <TableCell>{entry.completedCount}</TableCell>
            <TableCell>{entry.avgSubmissionTime}</TableCell>
            <TableCell className="text-center">
              {entry.leetcodeCookieStatus === 'LINKED' && entry.leetcodeTotalSolved ? (
                <div className="space-y-1">
                  <div className="font-medium text-primary">
                    {entry.leetcodeTotalSolved} solved
                  </div>
                  <div className="flex justify-center space-x-1">
                    <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800">
                      E: {entry.leetcodeEasySolved || 0}
                    </Badge>
                    <Badge variant="outline" className="text-xs bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800">
                      M: {entry.leetcodeMediumSolved || 0}
                    </Badge>
                    <Badge variant="outline" className="text-xs bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800">
                      H: {entry.leetcodeHardSolved || 0}
                    </Badge>
                  </div>
                </div>
              ) : entry.leetcodeCookieStatus === 'EXPIRED' ? (
                <Badge variant="destructive" className="text-xs">
                  Expired
                </Badge>
              ) : (
                <span className="text-muted-foreground text-sm">Not linked</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default LeaderboardTable;
