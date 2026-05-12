import type { JiraClient } from './client.js';

export interface CustomFields {
  storyPointsField: string | null;
  epicLinkField: string | null;
}

let cached: CustomFields | null = null;

export async function discoverCustomFields(client: JiraClient): Promise<CustomFields> {
  if (cached) return cached;

  const fields = await client.get<Array<{ id: string; name: string }>>('/rest/api/3/field');

  let storyPointsField: string | null = null;
  let epicLinkField: string | null = null;

  for (const field of fields) {
    const name = field.name.toLowerCase();
    if (!storyPointsField && (name === 'story points' || name === 'story point estimate')) {
      storyPointsField = field.id;
    }
    if (!epicLinkField && name === 'epic link') {
      epicLinkField = field.id;
    }
  }

  cached = { storyPointsField, epicLinkField };
  return cached;
}
