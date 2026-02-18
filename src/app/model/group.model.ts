import { ClassDate } from './classDate.model';

export interface Group {
  id: string;
  courseId: string;
  name: string;
  classDates?: ClassDate[];
}
