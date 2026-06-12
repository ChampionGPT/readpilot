import { describe, it, expect } from 'vitest';
import { classifyTool } from './tool-classifier';

describe('classifyTool', () => {
  it('classifies TodoWrite', () => expect(classifyTool('TodoWrite')).toBe('todo_write'));
  it('classifies Task', () => expect(classifyTool('Task')).toBe('task'));
  it('classifies Read', () => expect(classifyTool('Read')).toBe('read'));
  it('classifies Edit', () => expect(classifyTool('Edit')).toBe('edit'));
  it('classifies MultiEdit as edit', () => expect(classifyTool('MultiEdit')).toBe('edit'));
  it('classifies Write', () => expect(classifyTool('Write')).toBe('write'));
  it('classifies Bash', () => expect(classifyTool('Bash')).toBe('bash'));
  it('classifies PowerShell as bash', () => expect(classifyTool('PowerShell')).toBe('bash'));
  it('classifies Skill prefixed name', () => expect(classifyTool('Skill')).toBe('skill'));
  it('classifies mcp__plugin_xx as skill', () => expect(classifyTool('mcp__plugin_foo__bar')).toBe('skill'));
  it('falls back to generic', () => expect(classifyTool('UnknownTool')).toBe('generic'));
});
