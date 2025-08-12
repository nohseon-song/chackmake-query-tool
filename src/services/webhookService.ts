import { Reading } from '@/types';
import { supabase } from '@/integrations/supabase/client';

export const sendWebhookData = async (
  payload: { readings?: Reading[]; chat?: string; timestamp: number } & Record<string, any>
) => {
  const wrappedPayload = { ...payload } as any;
  const candidateKeys = ['expert_profile_html', 'expert_profile', 'expertProfile'];
  for (const key of candidateKeys) {
    const val = wrappedPayload[key];
    if (typeof val === 'string' && val.trim()) {
      const alreadyWrapped = /class=["']expert-profile["']/.test(val);
      const wrapped = alreadyWrapped ? val : `<div class="expert-profile">${val}</div>`;
      wrappedPayload[key] = wrapped;
      wrappedPayload[`${key}_html`] = wrapped;
    }
  }

  const { data, error } = await supabase.functions.invoke('send-webhook-to-make', {
    body: wrappedPayload,
  });

  if (error) {
    console.error("Supabase function invocation error:", error);
    throw new Error(`Failed to invoke webhook function: ${error.message}`);
  }
  
  return data;
};