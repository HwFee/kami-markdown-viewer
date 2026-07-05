import { compactPath } from "./path";

test("compactPath keeps short paths intact", () => {
  expect(compactPath("C:/notes/readme.md", 40)).toBe("C:/notes/readme.md");
});

test("compactPath shortens long paths from the left", () => {
  expect(compactPath("C:/Users/name/Documents/project/notes/readme.md", 28)).toBe(".../project/notes/readme.md");
});
