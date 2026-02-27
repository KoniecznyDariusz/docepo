export type SolutionStatus = '' | '-' | 'C' | 'G' | 'W' | 'U' | 'P' | 'N';

export interface Solution {
  id: string;
  studentId: string;
  taskId: string;
  completedAt: Date;
  points: number | null; // null = not graded yet, otherwise 0..maxPoints for the task
  comment: string;
  status: SolutionStatus; 
  // '' / '-' = not graded yet
  // 'C' = comment (co trzeba poprawić)
  // 'G' = graded
  // 'W' = warning
  // 'U' = uploaded to ePortal
  // 'P' = positive (zakończone pozytywnie)
  // 'N' = negative (zakończone negatywnie)
}
