# Contributing to QuestMaster

Thank you for your interest in contributing to QuestMaster! This document provides guidelines and instructions for contributing.

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Follow the project's coding standards
- Test your changes thoroughly

## Getting Started

1. **Fork the repository**
2. **Clone your fork**: `git clone <your-fork-url>`
3. **Create a branch**: `git checkout -b feature/your-feature-name`
4. **Make your changes**
5. **Test thoroughly**
6. **Commit your changes**: Use conventional commits
7. **Push to your fork**: `git push origin feature/your-feature-name`
8. **Open a Pull Request**

## Development Setup

See [DEVELOPMENT.md](docs/DEVELOPMENT.md) for detailed setup instructions.

Quick start:
```bash
# Install dependencies
cd agent && npm install
cd ../frontend && npm install

# Start development servers
cd agent && npm run dev
cd frontend && npm run dev
```

## Coding Standards

### TypeScript

- Use strict mode
- Prefer interfaces over types
- Use explicit return types
- Avoid `any` type
- Use meaningful variable names

### React

- Use functional components
- Prefer hooks over class components
- Use `useCallback` and `useMemo` appropriately
- Keep components focused and small

### Code Style

- **Files**: camelCase for utilities, PascalCase for components
- **Variables**: camelCase
- **Constants**: UPPER_SNAKE_CASE
- **Types/Interfaces**: PascalCase

### Comments

- Use JSDoc for functions
- Explain "why" not "what"
- Keep comments up to date

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new feature
fix: fix bug
docs: update documentation
style: formatting changes
refactor: code restructuring
test: add tests
chore: maintenance tasks
```

Examples:
- `feat: add task search functionality`
- `fix: resolve task expiration bug`
- `docs: update API documentation`
- `refactor: simplify task operations`

## Testing

### Before Submitting

- Run all tests: `npm test` (agent) and `npm run build` (frontend)
- Test manually in browser
- Check for TypeScript errors: `npx tsc --noEmit`
- Verify no console errors

### Writing Tests

- Write tests for new features
- Update tests for changed features
- Aim for good coverage
- Test edge cases

## Pull Request Process

### Before Opening PR

1. **Update documentation** if needed
2. **Add tests** for new features
3. **Update CHANGELOG** (if maintained)
4. **Ensure tests pass**
5. **Check for linting errors**

### PR Description

Include:
- **What**: What changes were made
- **Why**: Why these changes were needed
- **How**: How the changes work
- **Testing**: How to test the changes
- **Screenshots**: If UI changes

### Review Process

- Address review comments promptly
- Be open to feedback
- Ask questions if unclear
- Keep PR focused (one feature/fix per PR)

## Areas for Contribution

### High Priority

- Bug fixes
- Performance improvements
- Security enhancements
- Documentation improvements

### Feature Ideas

- Mobile app support
- Offline functionality
- Multi-user quests/parties
- Enhanced AI narration
- Additional task types
- Export/import functionality

### Documentation

- Code comments
- API documentation
- Tutorials and guides
- Examples and demos

## Reporting Issues

### Bug Reports

Include:
- **Description**: Clear description of the bug
- **Steps to Reproduce**: Detailed steps
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Environment**: OS, browser, Node version
- **Screenshots**: If applicable

### Feature Requests

Include:
- **Use Case**: Why this feature is needed
- **Proposed Solution**: How it could work
- **Alternatives**: Other approaches considered
- **Additional Context**: Any other relevant info

## Questions?

- Check existing documentation
- Search existing issues
- Open a discussion for questions
- Be patient for responses

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.

Thank you for contributing to QuestMaster! 🎲⚔️

