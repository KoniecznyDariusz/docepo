export interface Task {
  id: string;
  courseId: string;
  name: string; // e.g., L01, L02
  description: string;
  maxPoints: number; // typically 50 or 100
  dueDate: Date;
}
