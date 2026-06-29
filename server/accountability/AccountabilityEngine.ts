import { store } from '../db/store';
import { Subtask, Profile, TaxEffect, Tone } from '../../src/types';
import { v4 as uuidv4 } from 'uuid';

export const AccountabilityEngine = {
  getGracePeriodMinutes(tone: Tone): number {
    switch (tone) {
      case 'gentle': return 60;
      case 'neutral': return 30;
      case 'firm': return 10;
      case 'maximum_firmness': return 0;
      default: return 30;
    }
  },

  checkAndApplyPenalties(userId: string, currentVirtualTime: number): { taxes: TaxEffect[]; missedCount: number } {
    const profile = store.getDoc('profiles', userId) as Profile;
    if (!profile) return { taxes: [], missedCount: 0 };

    // 1. Deactivate expired taxes
    const allTaxes = store.query('taxes', t => t.userId === userId) as TaxEffect[];
    allTaxes.forEach(tax => {
      if (tax.active && currentVirtualTime >= tax.expiresAt) {
        store.updateDoc('taxes', tax.id, { active: false });
      }
    });

    // 2. Scan for overdue subtasks
    const activeTaxes = store.query('taxes', t => t.userId === userId && t.active) as TaxEffect[];
    const isMaxFirmnessActive = activeTaxes.some(t => t.type === 'max_firmness');
    const effectiveTone = isMaxFirmnessActive ? 'maximum_firmness' : profile.tone;

    const subtasks = store.query('subtasks', s => s.userId === userId && s.status === 'pending' && !s.missedFlagged) as Subtask[];
    let missedCount = 0;

    // Define virtual midnight for the current virtual day
    const d = new Date(currentVirtualTime);
    d.setHours(23, 59, 59, 999);
    const virtualMidnight = d.getTime();

    subtasks.forEach(subtask => {
      if (subtask.assignedSlot) {
        const graceMinutes = this.getGracePeriodMinutes(effectiveTone);
        const deadlineWithGrace = subtask.assignedSlot.end + graceMinutes * 60 * 1000;

        if (currentVirtualTime > deadlineWithGrace) {
          // Mark as missed and flag it so we don't apply penalties repeatedly in the next poll
          store.updateDoc('subtasks', subtask.id, { 
            status: 'missed',
            missedFlagged: true
          });
          missedCount++;

          // Levy a tax effect based on accountability tone
          let taxType: 'shorten_next_block' | 'lock_element' | 'max_firmness' = 'shorten_next_block';
          if (profile.tone === 'neutral') {
            taxType = 'lock_element';
          } else if (profile.tone === 'firm') {
            taxType = 'max_firmness';
          }

          const taxId = uuidv4();
          const newTax: TaxEffect = {
            id: taxId,
            userId,
            type: taxType,
            targetElement: taxType === 'lock_element' ? 'settings_and_warp' : undefined,
            expiresAt: virtualMidnight,
            active: true
          };
          store.setDoc('taxes', taxId, newTax);
        }
      }
    });

    // Get currently active taxes
    const currentActiveTaxes = store.query('taxes', t => t.userId === userId && t.active) as TaxEffect[];

    return {
      taxes: currentActiveTaxes,
      missedCount
    };
  }
};
