import { defineExtensionMessaging } from '@webext-core/messaging';

// Typed response interfaces
interface CourseItem {
  id: number;
  fullname: string;
  shortname: string;
  visible: boolean;
  viewurl: string;
}

interface AssignmentItem {
  id: number;
  cmid: number;
  courseId: number;
  courseName: string;
  courseShortname: string;
  name: string;
  duedate: number;
  submissionStatus: string;
  isOverdue: boolean;
  url?: string;
}

interface FileItem {
  sectionName: string;
  moduleName: string;
  filename: string;
  fileurl: string;
  filesize: number;
  mimetype?: string;
}

interface CalendarEventItem {
  id: number;
  name: string;
  timestart: number;
  eventtype: string;
  overdue: boolean;
  course?: { id: number; fullname: string; shortname: string };
  url: string;
}

interface NewsItem {
  subject: string;
  message: string;
  author: string;
  time: number;
}

interface NotificationItem {
  id: number;
  subject: string;
  message: string;
  from: string;
  time: number;
  read: boolean;
  url: string;
}

interface ProtocolMap {
  // Auth
  checkSession: () => { loggedIn: boolean; fullname?: string; error?: string };
  saveSessionInfo: (data: { sesskey: string; userid?: number; fullname?: string; username?: string }) => void;
  loginWithToken: (data: { token: string }) => { success: boolean; error?: string };
  logout: () => void;
  getAuthState: () => { loggedIn: boolean; fullname?: string; authMode: string };

  // Courses
  getCourses: () => { courses: CourseItem[] };

  // Assignments
  getPendingAssignments: () => { assignments: AssignmentItem[] };

  // Files
  getCourseFiles: (data: { courseid: number; typeFilter?: string[] }) => { files: FileItem[] };
  downloadCourseFiles: (data: { courseid: number; typeFilter?: string[] }) => { count: number };

  // Upload
  uploadAndSubmit: (data: { assignmentId: number; itemid: number }) => { success: boolean };

  // Calendar
  getCalendarEvents: (data: { days: number }) => { events: CalendarEventItem[] };

  // Grades
  getGrades: (data: { courseid?: number }) => { grades: unknown };

  // News
  getNews: (data: { courseId?: number }) => { news: NewsItem[] };

  // Notifications
  getNotifications: (data: { limit: number }) => { notifications: NotificationItem[] };

  // CLI export
  exportForCli: () => { cookie: string; instructions: string };
}

export type { CourseItem, AssignmentItem, FileItem, CalendarEventItem, NewsItem, NotificationItem };
export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();
