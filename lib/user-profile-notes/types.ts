export type UserProfileNote = {
  id: string;
  subjectUserId: string;
  authorUserId: string | null;
  authorName: string | null;
  authorRole: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
};
