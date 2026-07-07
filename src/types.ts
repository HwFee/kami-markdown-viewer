export type LoadedDocument = {
  path: string;
  fileName: string;
  parentPath: string;
  markdown: string;
};

export type OutlineHeading = {
  id: string;
  level: 1 | 2 | 3;
  text: string;
};

export type DocumentState =
  | { status: "empty" }
  | { status: "loading" }
  | { status: "ready"; document: LoadedDocument }
  | { status: "error"; message: string; path?: string };
