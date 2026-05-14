import type { JiraClient } from './client.js';

export interface CustomFields {
  storyPointsField: string | null;
  epicLinkField: string | null;
}

let cached: CustomFields | null = null;

export async function discoverCustomFields(client: JiraClient): Promise<CustomFields> {
  if (cached) return cached;

  const fields = await client.get<Array<{ id: string; name: string }>>('/rest/api/3/field');

  const storyPointsField =
    fields.find((f) => ['story points', 'story point estimate'].includes(f.name.toLowerCase()))?.id ??
    null;

  const epicLinkField =
    fields.find((f) => f.name.toLowerCase() === 'epic link')?.id ?? null;

  cached = { storyPointsField, epicLinkField };
  return cached;
}
