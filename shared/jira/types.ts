export interface JiraIssueRaw {
  id: string;
  key: string;
  fields: Record<string, unknown>;
}

export interface JiraCommentRaw {
  id: string;
  author: {
    displayName: string;
    accountId: string;
  };
  created: string;
  body: unknown;
}
