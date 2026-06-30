import { Type, Schema } from '@google/genai';
import { Profile, Subtask, TaskType } from '../../../src/types';
import { DAGValidator } from './DAGValidator';
import { v4 as uuidv4 } from 'uuid';
import { getAI } from '../../ai';
import { DeterministicScheduler } from '../../scheduler/DeterministicScheduler';
import { VirtualClock } from '../../time/VirtualClock';

const schema: Schema = {
  type: Type.OBJECT,
  properties: {
    task_type: { type: Type.STRING, enum: ['execution', 'learning_goal'], description: 'Auto-detected type of the task.' },
    subtasks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: 'Unique string ID for the subtask' },
          title: { type: Type.STRING },
          estimatedDuration: { type: Type.INTEGER, description: 'Duration in minutes' },
          dependencies: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: 'List of IDs of subtasks that must be completed before this one'
          },
          order: { type: Type.INTEGER }
        },
        required: ['id', 'title', 'estimatedDuration', 'dependencies', 'order']
      }
    }
  },
  required: ['task_type', 'subtasks']
};

export const DecompositionEngine = {
  async decompose(
    description: string, 
    deadlineMinutes: number, 
    profile: Profile,
    settings: any,
    multiplier: number = 1.0,
    timezoneOffset: number = 0
  ): Promise<{ taskType: TaskType; subtasks: Partial<Subtask>[]; traceMessages: string[] }> {
    const prompt = `
You are the Planner Agent for a user named ${profile.id}.
User goals: ${profile.goals}
Context: ${profile.context}
Accountability Tone: ${profile.tone}

Decompose the following task into a DAG of subtasks.
If it is a concrete execution task, make it a flat actionable checklist (few dependencies).
If it is a learning goal, structure it as a curriculum progression (strong dependencies).
Max available time: ${deadlineMinutes > 0 ? deadlineMinutes + ' minutes' : 'Unknown'}.

Task: ${description}
`;

    const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash'];
    let lastError: any = null;

    for (const modelName of modelsToTry) {
      try {
        console.log(`Attempting decomposition with model: ${modelName}`);
        const response = await getAI().models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: schema,
            temperature: 0.2
          }
        });

        const data = JSON.parse(response.text || '{}');
        let subtasks = data.subtasks || [];
        
        // Apply duration multiplier and cap duration to 240 minutes (4 hours) 
        // to ensure tasks fit within standard focus windows.
        subtasks = subtasks.map((st: any) => ({
          ...st,
          estimatedDuration: Math.min(240, Math.ceil((st.estimatedDuration || 15) * multiplier))
        }));

        const valResult = DAGValidator.validate(subtasks, deadlineMinutes);
        
        if (valResult.isValid) {
          const count = subtasks.length;
          const subtasksWithDeps = subtasks.filter((st: any) => st.dependencies && st.dependencies.length > 0).length;
          const plannerTrace = `Planner Agent — Classified as ${data.task_type || 'execution'} task. Generated ${count} subtasks with ${subtasksWithDeps} dependency connections.`;

          // Speculative scheduling to generate Scheduler trace:
          const { traceMessage: schedulerTrace } = DeterministicScheduler.schedule(
            subtasks,
            profile,
            settings || {},
            VirtualClock.getVirtualTime(),
            timezoneOffset,
            true // isSpeculative
          );

          return {
            taskType: data.task_type || 'execution',
            subtasks,
            traceMessages: [plannerTrace, valResult.traceMessage, schedulerTrace]
          };
        } else {
          console.warn(`DAG Validation failed for model ${modelName}:`, valResult.errors);
        }
      } catch (e: any) {
        lastError = e;
        console.warn(`Decomposition with model ${modelName} failed. Error message: ${e?.message || e}. Full error:`, e);
      }
    }

    // Heuristic Fallback (Runs if all Gemini models are exhausted or rate-limited)
    console.info("Using dynamic high-fidelity local fallback planner.");
    const isLearningGoal = /learn|study|understand|course|read|research|tutorial/i.test(description);
    
    const subtaskSteps: string[] = [];
    if (isLearningGoal) {
      subtaskSteps.push("Conduct initial literature review & assemble learning resources");
      subtaskSteps.push("Study fundamental concepts & core principles");
      subtaskSteps.push("Perform a hands-on practical exercise or build a mini-prototype");
      subtaskSteps.push("Consolidate key concepts & identify advanced follow-ups");
    } else {
      subtaskSteps.push("Establish prerequisites, dependencies, and environment setup");
      subtaskSteps.push("Build core functionality & functional skeleton");
      subtaskSteps.push("Execute comprehensive manual verification & refine details");
      subtaskSteps.push("Complete packaging, polish, and perform final review");
    }

    const availableTime = deadlineMinutes > 0 ? deadlineMinutes : 120;
    // Cap duration to 120 minutes (2 hours) for the fallback subtasks to be safe
    const durationPerStep = Math.min(120, Math.max(15, Math.ceil((availableTime / subtaskSteps.length) * multiplier)));

    const fallbackSubtasks: Partial<Subtask>[] = subtaskSteps.map((step, index) => {
      return {
        id: `local-subtask-${index + 1}-${uuidv4().substring(0, 4)}`,
        title: step,
        estimatedDuration: durationPerStep,
        dependencies: [],
        order: index + 1
      };
    });

    // Wire up sequential dependencies for learning goals
    if (isLearningGoal) {
      for (let i = 1; i < fallbackSubtasks.length; i++) {
        fallbackSubtasks[i].dependencies = [fallbackSubtasks[i - 1].id!];
      }
    }

    const count = fallbackSubtasks.length;
    const subtasksWithDeps = fallbackSubtasks.filter((st: any) => st.dependencies && st.dependencies.length > 0).length;
    const plannerTrace = `Planner Agent (Fallback) — Classified as ${isLearningGoal ? 'learning_goal' : 'execution'} task. Generated ${count} fallback subtasks with ${subtasksWithDeps} dependency connections.`;
    const valResult = DAGValidator.validate(fallbackSubtasks, deadlineMinutes);

    // Speculative scheduling to generate Scheduler trace:
    const { traceMessage: schedulerTrace } = DeterministicScheduler.schedule(
      fallbackSubtasks,
      profile,
      settings || {},
      VirtualClock.getVirtualTime(),
      timezoneOffset,
      true // isSpeculative
    );

    return {
      taskType: isLearningGoal ? 'learning_goal' : 'execution',
      subtasks: fallbackSubtasks,
      traceMessages: [plannerTrace, valResult.traceMessage, schedulerTrace]
    };
  }
};
