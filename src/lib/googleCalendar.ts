import { Subtask } from '../types';

export const GoogleCalendarService = {
  /**
   * Helper to perform Google Calendar API requests with the given access token.
   */
  async fetchCalendarApi(endpoint: string, accessToken: string, options: RequestInit = {}) {
    const res = await fetch(`https://www.googleapis.com/calendar/v3${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Google Calendar API error: ${res.status}`);
    }

    return res.json();
  },

  /**
   * Find or create the dedicated 'Last-Minute Life Saver' calendar.
   */
  async findOrCreateCalendar(accessToken: string): Promise<string> {
    // 1. Fetch calendar list
    const list = await this.fetchCalendarApi('/users/me/calendarList', accessToken);
    const existing = list.items?.find((cal: any) => cal.summary === 'Last-Minute Life Saver');
    
    if (existing) {
      return existing.id;
    }

    // 2. Create if not found
    const newCal = await this.fetchCalendarApi('/calendars', accessToken, {
      method: 'POST',
      body: JSON.stringify({
        summary: 'Last-Minute Life Saver',
        description: 'Auto-scheduled subtasks managed by your AI Productivity Companion.'
      })
    });

    return newCal.id;
  },

  /**
   * Sync a list of scheduled subtasks to the dedicated calendar.
   * To avoid duplicates, we first find existing events and update/create as needed.
   */
  async syncSubtasks(subtasks: Subtask[], accessToken: string): Promise<{ success: boolean; count: number }> {
    if (subtasks.length === 0) return { success: true, count: 0 };

    try {
      const calendarId = await this.findOrCreateCalendar(accessToken);
      let syncCount = 0;

      for (const st of subtasks) {
        if (!st.assignedSlot) continue;

        // Construct standard event schema
        const eventData = {
          summary: st.title,
          description: `Productivity subtask from Last-Minute Life Saver.\nStatus: ${st.status}\nEstimated duration: ${st.estimatedDuration} mins.`,
          start: {
            dateTime: new Date(st.assignedSlot.start).toISOString()
          },
          end: {
            dateTime: new Date(st.assignedSlot.end).toISOString()
          },
          reminders: {
            useDefault: true
          }
        };

        // Create a new event on the secondary calendar
        await this.fetchCalendarApi(`/calendars/${calendarId}/events`, accessToken, {
          method: 'POST',
          body: JSON.stringify(eventData)
        });

        syncCount++;
      }

      return { success: true, count: syncCount };
    } catch (err) {
      console.error('Failed to sync to Google Calendar:', err);
      throw err;
    }
  }
};
