# Repository instructions

## Product language

- All shipped UI text, help, tooltips, errors, code, identifiers, comments, tests, and operational documentation must be in English. English abbreviations are allowed.
- Planning documents and conversations may contain Chinese; they are not product copy.
- Preserve original source names and proper nouns. Do not translate or alter skater names, club names, or original evidence.
- The Chinese explanatory text in the implementation plan is for planning only; ship only the English Skating age explanation.

## Pull request merge policy

- Use **squash and merge** for all pull requests by default.
- If a pull request contains multiple commits, squash and merge is required.
- If a pull request contains exactly one commit, a regular merge is permitted; squash and merge is still preferred.
- Check the current PR commit count before selecting the merge method.

## Sub-agent self-review boundaries

- Declare a finite boundary before executing any sub-agent self-review loop.
- Default to at most 2 self-review iterations unless the user explicitly requests a different finite limit.
- Stop early when acceptance criteria pass, a review finds no actionable issues, or the next iteration would repeat an already-attempted fix.
- A self-reviewing sub-agent must not spawn another self-reviewing sub-agent or reset or extend its own iteration limit.
- At the limit, return the current result, remaining issues, and recommended next action to the parent agent; never continue indefinitely.
