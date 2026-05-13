import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Announcement } from '../../types';
import AnnouncementCard from './AnnouncementCard';
import CreateAnnouncementForm from './CreateAnnouncementForm';
import * as announcementApi from '../../api/announcements';
import { classAnnouncementsQueryKey } from '@/lib/classPageQuery';

interface AnnouncementListProps {
  announcements: Announcement[];
  isTeacher: boolean;
  classId: string;
}

const AnnouncementList: React.FC<AnnouncementListProps> = ({ announcements, isTeacher, classId }) => {
  const queryClient = useQueryClient();
  const [announcementList, setAnnouncementList] = useState<Announcement[]>(announcements);

  useEffect(() => {
    setAnnouncementList(announcements);
  }, [announcements]);

  const handleAnnouncementCreated = (newAnnouncement: Announcement) => {
    setAnnouncementList([newAnnouncement, ...announcementList]);
    void queryClient.invalidateQueries({ queryKey: classAnnouncementsQueryKey(classId) });
  };

  const handleAnnouncementDeleted = (announcementId: string) => {
    setAnnouncementList(announcementList.filter(a => a.id !== announcementId));
    void queryClient.invalidateQueries({ queryKey: classAnnouncementsQueryKey(classId) });
  };

  return (
    <div>
      {isTeacher && (
        <div className="mb-6">
          <CreateAnnouncementForm
            classId={classId}
            onAnnouncementCreated={handleAnnouncementCreated}
            createFunction={announcementApi.createAnnouncement}
          />
        </div>
      )}
      <h3 className="text-2xl font-bold mb-4">Announcements</h3>
      {announcementList.length > 0 ? (
        announcementList.map(announcement => (
          <AnnouncementCard
            key={announcement.id}
            announcement={announcement}
            onDelete={handleAnnouncementDeleted}
            deleteFunction={announcementApi.deleteAnnouncement}
          />
        ))
      ) : (
        <p className="text-muted-foreground">No announcements yet.</p>
      )}
    </div>
  );
};

export default AnnouncementList; 