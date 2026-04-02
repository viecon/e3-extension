import { defineExtensionMessaging } from '@webext-core/messaging';

interface ProtocolMap {
  // Auth
  checkSession: () => { loggedIn: boolean; fullname?: string; error?: string };
  saveSessionInfo: (data: { sesskey: string; userid?: number; fullname?: string; username?: string }) => void;
  loginWithToken: (data: { token: string }) => { success: boolean; error?: string };
  logout: () => void;
  getAuthState: () => { loggedIn: boolean; fullname?: string; authMode: string };

  // Courses
  getCourses: () => { courses: unknown[] };

  // Assignments
  getPendingAssignments: () => { assignments: unknown[] };

  // Files
  getCourseFiles: (data: { courseid: number; typeFilter?: string[] }) => { files: unknown[] };
  downloadCourseFiles: (data: { courseid: number; typeFilter?: string[] }) => { count: number };

  // Upload
  uploadAndSubmit: (data: { assignmentId: number; itemid: number }) => { success: boolean };

  // Calendar
  getCalendarEvents: (data: { days: number }) => { events: unknown[] };

  // Grades
  getGrades: (data: { courseid?: number }) => { grades: unknown };

  // News (forum announcements)
  getNews: (data: { courseId?: number }) => { news: unknown[] };

  // Notifications
  getNotifications: (data: { limit: number }) => { notifications: unknown[] };

  // CLI export
  exportForCli: () => { cookie: string; instructions: string };
}

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();
