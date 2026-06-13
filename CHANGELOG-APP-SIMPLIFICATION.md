# App simplification update

This build implements the requested product simplification around three core flows:

1. Drug search
2. Drug import / maintenance
3. Candidate order generation

## Main changes

- Removed the standalone home route from the active navigation. The app now opens directly into drug search.
- Reduced the sidebar to three main entries: Drug Search, Import/Maintain, Candidate Orders.
- Simplified the drug search page so the default view shows only the search box. Classification, dosage form, and route filters are under Advanced Filters.
- Added a Maintain/Edit action on the drug detail page. Existing saved drugs can be reopened from the detail page and edited through the import/maintenance page.
- Simplified import basics to the core fields: Chinese generic name, drug system, drug classification, dosage form, route, strength, and dosage instructions.
- Changed strength from a unit dropdown to free text so real-world specifications such as `0.25g`, `5mg`, `100ml:0.9g`, and `10mg/tablet` are easier to enter.
- Moved English name, aliases, secondary category, pharmacologic class, prescription type, package unit, manufacturer, approval number, source info, actor, and risk tags into More Info.
- Reworked import into a single flow: parse and preview, edit form, confirm save and update index.
- Merged OCR text into the package insert text entry. There is no separate OCR image flow in the normal UI.
- Moved plugin list and standard `drug.md` maintenance into Advanced Maintenance Tools.
- Added duplicate drug hints when the entered Chinese generic name already matches existing drugs.
- Added edit preview diff for key label fields when maintaining an existing drug.
- Simplified the candidate order page. Patient context fields are now under Supplemental Patient Context.
- Updated backend save behavior so re-saving an existing drug overwrites the old file, rebuilds the index, increments the version, and removes the old file if the classification path changed.

## Verification

- `npm run compile:web` passed.
- `npm run compile:api` passed after installing server dev dependencies.
- `npm run build:indexes` passed.
- `npm run build:public-snapshot` passed.
- `npm run smoke:test` passed.
