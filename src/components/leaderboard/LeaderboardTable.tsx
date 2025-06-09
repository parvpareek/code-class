import React, { useState } from 'react';
import { LeaderboardEntry } from '../../types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Award, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  showScore?: boolean;
}

type SortKey = 'rank' | 'name' | 'completedCount' | 'avgSubmissionTime' | 'totalScore';
type SortDirection = 'asc' | 'desc';

const LeaderboardTable: React.FC<LeaderboardTableProps> = ({ entries, showScore = false }) => {
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
        if (timeStr.startsWith('<')) return 30; // Approx. for sorting
        
        let totalMinutes = 0;
        const parts = timeStr.split(' ');

        parts.forEach(part => {
          if (part.endsWith('d')) {
            totalMinutes += parseInt(part, 10) * 24 * 60;
          } else if (part.endsWith('h')) {
            totalMinutes += parseInt(part, 10) * 60;
          }
        });
        
        return totalMinutes;
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
      case 1: return "text-yellow-500";
      case 2: return "text-gray-400";
      case 3: return "text-amber-700";
      default: return "text-gray-600";
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
              Completed
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
          {showScore && (
            <TableHead>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => handleSort('totalScore')}
                className="font-medium flex items-center -ml-3"
              >
                Score
                <SortIcon active={sortKey === 'totalScore'} />
              </Button>
            </TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedEntries.map((entry) => (
          <TableRow key={entry.id} className={entry.rank <= 3 ? "bg-yellow-50" : ""}>
            <TableCell className="font-medium">
              <div className="flex items-center">
                {entry.rank <= 3 ? (
                  <Award className={`h-5 w-5 mr-1 ${getMedalColor(entry.rank)}`} />
                ) : (
                  entry.rank
                )}
              </div>
            </TableCell>
            <TableCell>{entry.name}</TableCell>
            <TableCell>{entry.completedCount}</TableCell>
            <TableCell>{entry.avgSubmissionTime}</TableCell>
            {showScore && (
              <TableCell>
                <span className="font-mono text-blue-600">{entry.totalScore}</span>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default LeaderboardTable;
