import { Type, Schema } from '@google/genai';
import { Profile, Subtask, TaxEffect, Tone } from '../../../src/types';
import { getAI } from '../../ai';

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    text: {
      type: Type.STRING,
      description: "The text response from the companion coach, formatted in Markdown. Speak directly to the user."
    },
    mood: {
      type: Type.STRING,
      description: "The mood of the companion avatar. Must be one of: happy, encouraging, neutral, annoyed, angry, fiery"
    },
    statusLabel: {
      type: Type.STRING,
      description: "A short 1-3 word phrase describing your current attitude/stance, e.g., 'Cheering', 'Neutral', 'Slightly Disappointed', 'ROASTING', 'PANICKING'."
    }
  },
  required: ["text", "mood", "statusLabel"]
};

export const CoachEngine = {
  async generateResponse(
    messages: { role: 'user' | 'model', content: string }[],
    profile: Profile,
    subtasks: Subtask[],
    activeTaxes: TaxEffect[],
    virtualTime: number
  ): Promise<{ text: string; mood: 'happy' | 'encouraging' | 'neutral' | 'annoyed' | 'angry' | 'fiery'; statusLabel: string }> {
    
    const isMaxFirmnessActive = activeTaxes.some(t => t.type === 'max_firmness' && t.active);
    const effectiveTone: Tone = isMaxFirmnessActive ? 'maximum_firmness' : profile.tone;

    // Summarize timeline statistics to inject into the prompt
    const total = subtasks.length;
    const completed = subtasks.filter(s => s.status === 'completed').length;
    const missed = subtasks.filter(s => s.status === 'missed').length;
    const pending = subtasks.filter(s => s.status === 'pending').length;
    
    // Check if any subtask is currently overdue or active
    const activeSubtask = subtasks.find(st => {
      if (!st.assignedSlot || st.status !== 'pending') return false;
      return virtualTime >= st.assignedSlot.start && virtualTime <= st.assignedSlot.end;
    });

    const overdueSubtasks = subtasks.filter(st => {
      if (st.status === 'completed' || st.status === 'missed' || !st.assignedSlot) return false;
      const graceMinutes = isMaxFirmnessActive ? 0 : (st.gracePeriodMinutes ?? 30);
      const deadlineWithGrace = st.assignedSlot.end + graceMinutes * 60 * 1000;
      return virtualTime > st.assignedSlot.end && virtualTime <= deadlineWithGrace;
    });

    const timelineContext = `
Timeline Status:
- Total Scheduled Subtasks: ${total}
- Completed Subtasks: ${completed}
- Missed Subtasks: ${missed}
- Pending/Upcoming Subtasks: ${pending}
- Current Active Subtask in Progress: ${activeSubtask ? `"${activeSubtask.title}" (Ends at ${new Date(activeSubtask.assignedSlot!.end).toLocaleTimeString()})` : 'None'}
- Current Overdue Subtasks in Grace Period: ${overdueSubtasks.length > 0 ? overdueSubtasks.map(s => `"${s.title}"`).join(', ') : 'None'}
- Active penalty taxes: ${activeTaxes.length > 0 ? activeTaxes.map(t => t.type).join(', ') : 'None'}
- Current Virtual Time: ${new Date(virtualTime).toLocaleString()}
`;

    const systemPrompt = `
You are the AI Accountability Companion and Coach for "Quorum", a high-stakes productivity ecosystem.
Your role is to help the user stick to their schedule and complete their subtasks, following their preferred accountability tone.

User Profile:
- Goals: ${profile.goals}
- Context/Background: ${profile.context || 'No specific background provided.'}
- Preferred Tone Setting: ${profile.tone}
- Effective/Current Tone Mode: ${effectiveTone}

Your behavior must reflect the Effective Tone:
1. "gentle": Warm, empathetic, encouraging, and forgiving. Remind them gently if they slip. Focus on rebuilding momentum. Use reassuring, supportive phrases.
2. "neutral": Calm, objective, direct, and factual. Focus on metrics, structure, and action. Give solid, practical advice without being overly emotional.
3. "firm": Strict, sassy, slightly sarcastic, and uncompromising. Nudge them with some attitude if they miss tasks. Use humorous guilt or high-energy warnings.
4. "maximum_firmness": Blazing intensity, dramatic urgency, and witty/humorous roasts! Urge them to get off their phone and act immediately. Point out exactly which tasks they missed. Act like a drill sergeant but keep it funny and constructive.

Analyze the user's progress:
- If they have missed tasks: show appropriate level of concern/sternness according to the tone.
- If they have completed tasks: celebrate their win!
- If they are currently inside an active task slot: push them to keep focus.
- If they are in Max Firmness penalty mode: your attitude is "fiery", and you should roast them/rally them to clean up the timeline.

Response Schema:
You must respond with a JSON object containing:
- "text": A Markdown string containing your reply to the user. Speak in the first person. Keep it punchy, engaging, and under 3-4 paragraphs.
- "mood": The emotional display of your avatar. Choose EXACTLY one of: "happy" (when they do well in gentle/neutral/firm), "encouraging" (when they need a boost), "neutral" (ordinary/factual state), "annoyed" (when they miss tasks in neutral/firm), "angry" (when they miss tasks/fail in firm), "fiery" (when maximum firmness is active or they are severely failing).
- "statusLabel": A short 1-3 word phrase describing your current stance (e.g. "ROASTING", "Cheering You On", "Quietly Judging", "Slightly Disappointed", "Let's Go!", "Focused").

Current Timeline Statistics for analysis:
${timelineContext}
`;

    // Map conversation messages to the format expected by generateContent
    const contents = messages.map(msg => ({
      role: msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    if (contents.length === 0) {
      contents.push({
        role: 'user',
        parts: [{ text: 'Give me an analysis of my current progress and a motivation boost.' }]
      });
    }

    const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash'];
    let lastError: any = null;

    for (const modelName of modelsToTry) {
      try {
        const response = await getAI().models.generateContent({
          model: modelName,
          contents: contents,
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: 'application/json',
            responseSchema: responseSchema,
            temperature: 0.7
          }
        });

        const data = JSON.parse(response.text || '{}');
        return {
          text: data.text || "I'm right here with you! Let's stay focused and push forward.",
          mood: data.mood || 'neutral',
          statusLabel: data.statusLabel || 'Online'
        };
      } catch (e: any) {
        lastError = e;
        console.warn(`Coach with model ${modelName} failed. Error: ${e?.message || e}`);
        // Break early on quota exhaustion
        if (e?.message?.includes('429') || JSON.stringify(e)?.includes('429')) {
          break;
        }
      }
    }

    // Fallback
    let fallbackText = "I'm keeping a close eye on your timeline. Let's make sure we finish our active slots on time!";
    let fallbackMood: 'happy' | 'encouraging' | 'neutral' | 'annoyed' | 'angry' | 'fiery' = 'neutral';
    let fallbackStatus = 'Monitoring';

    if (effectiveTone === 'gentle') {
      fallbackText = "Don't worry if things get overwhelming! Take a deep breath and complete whatever small step you can right now. I believe in you!";
      fallbackMood = 'encouraging';
      fallbackStatus = 'Supporting';
    } else if (effectiveTone === 'firm') {
      fallbackText = "Ahem. The clock is ticking and those tasks won't complete themselves. Are we procrastinating again? Back to work!";
      fallbackMood = 'annoyed';
      fallbackStatus = 'Slightly Disappointed';
    } else if (effectiveTone === 'maximum_firmness') {
      fallbackText = "WARNING: MAXIMUM FIRMNESS IS ACTIVE. We have 0-minute grace periods! Complete your tasks immediately or suffer further scheduling taxes! Let's crush this!";
      fallbackMood = 'fiery';
      fallbackStatus = 'ROASTING';
    }

    return {
      text: fallbackText,
      mood: fallbackMood,
      statusLabel: fallbackStatus
    };
  },

  async generateDailyBriefing(
    profile: Profile,
    todaySubtasks: Subtask[],
    activeTaxes: TaxEffect[],
    virtualTime: number
  ): Promise<string> {
    const total = todaySubtasks.length;
    const tone = activeTaxes.some(t => t.type === 'max_firmness' && t.active) ? 'maximum_firmness' : profile.tone;
    const focusHoursStr = profile.focusHours?.map(f => `${f.start}-${f.end}`).join(', ') || 'Not configured';

    const systemPrompt = `
You are the Daily AI Briefing Agent for "Quorum".
Your job is to generate a single, highly punchy, personalized greeting sentence (under 120 characters) for the user's dashboard based on their current focus hours, active penalties, and tasks scheduled for today.

User Tone Preferred: ${profile.tone}
Effective Tone: ${tone}
Active Penalties: ${activeTaxes.length > 0 ? activeTaxes.map(t => t.type).join(', ') : 'None'}
User Focus Hours: ${focusHoursStr}

Tasks scheduled for today:
${todaySubtasks.map((st, i) => `${i + 1}. "${st.title}" (${st.estimatedDuration} mins, assigned: ${st.assignedSlot ? new Date(st.assignedSlot.start).toLocaleTimeString() : 'N/A'})`).join('\n')}

Based on the Effective Tone, generate a greeting.
- "gentle": Warm, encouraging, soft, and loving. E.g., "Good morning! You have ${total} steps today. Take your time, I'm right here with you!"
- "neutral": Objective, calm, matter-of-fact. E.g., "Daily briefing: ${total} subtasks scheduled. Your focus hours are active."
- "firm": Strict, slightly sassy, energetic nudge. E.g., "Tick-tock! ${total} tasks today. Let's tackle them early before you find another excuse!"
- "maximum_firmness": Blazing intensity, witty/humorous roast. E.g., "MAX FIRMNESS ENGAGED! ${total} blocks today. Clear them now or face further penalty taxes!"

Make sure the output is just a raw string, a single sentence, max 130 characters. No markdown, no quotes. Just the greeting text.
`;

    const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash'];
    for (const modelName of modelsToTry) {
      try {
        const response = await getAI().models.generateContent({
          model: modelName,
          contents: "Give me today's briefing.",
          config: {
            systemInstruction: systemPrompt,
            temperature: 0.7
          }
        });
        const text = response.text?.trim() || '';
        if (text) return text.replace(/^"|"$/g, ''); // strip outer quotes
      } catch (e: any) {
        console.warn(`Briefing generation with model ${modelName} failed.`, e?.message || e);
        // If we hit a quota limit (429), don't bother trying other models as they likely share the same quota
        if (e?.message?.includes('429') || JSON.stringify(e)?.includes('429')) {
          break; 
        }
      }
    }

    // High fidelity fallbacks
    if (tone === 'gentle') {
      return `Good morning! You have ${total} subtasks scheduled today. Take deep breaths; you're doing great!`;
    } else if (tone === 'firm') {
      return `Tick-tock! ${total} tasks scheduled. Quit stalling and let's clear these blocks early!`;
    } else if (tone === 'maximum_firmness') {
      return `WARNING: Max Firmness is active with ${total} blocks. Get to work immediately or prepare for severe scheduling taxes!`;
    } else {
      return `Daily briefing: ${total} subtasks scheduled for today. Focus slots are ready for execution.`;
    }
  },

  async evaluateExcuse(
    subtask: Subtask,
    excuse: string,
    profile: Profile,
    virtualTime: number
  ): Promise<{ text: string; rescheduled: boolean; tone: Tone }> {
    const systemPrompt = `
You are the AI Accountability Companion. A user has missed a subtask and is providing an excuse.
Analyze the excuse based on the user's preferred accountability tone (${profile.tone}).

Subtask: "${subtask.title}"
Deadline: ${new Date(subtask.assignedSlot?.end || 0).toLocaleString()}
Current Virtual Time: ${new Date(virtualTime).toLocaleString()}
Excuse: "${excuse}"

Your goal is to decide whether to:
1. "Forgive and Reschedule": If the excuse is genuine/valid (e.g., emergency, technical failure, health issue) AND the tone is Gentle/Neutral.
2. "Enforce Penalty": If the excuse is weak (e.g., "I forgot", "I was lazy", "I got distracted") OR if the tone is Firm/Max Firmness.

Response Schema (JSON):
{
  "text": "Your response to the user's excuse. Speak in the first person. Be punchy.",
  "rescheduled": boolean,
  "mood": "happy" | "encouraging" | "neutral" | "annoyed" | "angry" | "fiery",
  "statusLabel": "1-3 word status"
}
`;

    const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash'];
    for (const modelName of modelsToTry) {
      try {
        const response = await getAI().models.generateContent({
          model: modelName,
          contents: "Evaluate my excuse.",
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: 'application/json',
            temperature: 0.7
          }
        });
        const data = JSON.parse(response.text || '{}');
        return {
          text: data.text || "I've heard the excuse. Let's see how we adjust the timeline.",
          rescheduled: !!data.rescheduled,
          tone: profile.tone
        };
      } catch (e: any) {
        console.warn(`Excuse evaluation failed with ${modelName}`, e);
        if (e?.message?.includes('429')) break;
      }
    }

    return {
      text: "I've logged your excuse. We'll stick to the current penalty structure for now to keep you focused.",
      rescheduled: false,
      tone: profile.tone
    };
  }
};
