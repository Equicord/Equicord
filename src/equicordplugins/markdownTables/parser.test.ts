/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { parseMarkdownTableBlock, parseMarkdownTableMatch, parseMarkdownTables } from "./parser";

function assertDeepEqual(actual: unknown, expected: unknown, message: string) {
    const actualJson = JSON.stringify(actual);
    const expectedJson = JSON.stringify(expected);

    if (actualJson !== expectedJson) {
        throw new Error(`${message}\nExpected: ${expectedJson}\nActual: ${actualJson}`);
    }
}

const fixtures = [
    {
        name: "basic pipe table",
        input: [
            "| Name | Status |",
            "| --- | --- |",
            "| Alpha | Ready |",
        ].join("\n"),
        expected: [
            {
                header: ["Name", "Status"],
                alignments: [null, null],
                rows: [["Alpha", "Ready"]],
                startLine: 0,
                endLine: 2,
            },
        ],
    },
    {
        name: "alignment markers",
        input: [
            "| Left | Center | Right |",
            "| :--- | :---: | ---: |",
            "| A | B | C |",
        ].join("\n"),
        expected: [
            {
                header: ["Left", "Center", "Right"],
                alignments: ["left", "center", "right"],
                rows: [["A", "B", "C"]],
                startLine: 0,
                endLine: 2,
            },
        ],
    },
    {
        name: "escaped pipes",
        input: [
            "| Key | Value |",
            "| --- | --- |",
            "| A \\| B | C |",
        ].join("\n"),
        expected: [
            {
                header: ["Key", "Value"],
                alignments: [null, null],
                rows: [["A | B", "C"]],
                startLine: 0,
                endLine: 2,
            },
        ],
    },
    {
        name: "escaped delimiter rows",
        input: [
            "\\| Key \\| Value \\|",
            "\\| --- \\| --- \\|",
            "\\| Alpha \\| Ready \\|",
        ].join("\n"),
        expected: [
            {
                header: ["Key", "Value"],
                alignments: [null, null],
                rows: [["Alpha", "Ready"]],
                startLine: 0,
                endLine: 2,
            },
        ],
    },
    {
        name: "no outer pipes",
        input: [
            "Name | Status",
            "--- | ---",
            "Alpha | Ready",
        ].join("\n"),
        expected: [
            {
                header: ["Name", "Status"],
                alignments: [null, null],
                rows: [["Alpha", "Ready"]],
                startLine: 0,
                endLine: 2,
            },
        ],
    },
    {
        name: "multiple tables",
        input: [
            "| A | B |",
            "| --- | --- |",
            "| 1 | 2 |",
            "",
            "| C | D |",
            "| --- | --- |",
            "| 3 | 4 |",
        ].join("\n"),
        expected: [
            {
                header: ["A", "B"],
                alignments: [null, null],
                rows: [["1", "2"]],
                startLine: 0,
                endLine: 2,
            },
            {
                header: ["C", "D"],
                alignments: [null, null],
                rows: [["3", "4"]],
                startLine: 4,
                endLine: 6,
            },
        ],
    },
    {
        name: "table surrounded by normal text",
        input: [
            "Before the table",
            "",
            "| A | B |",
            "| --- | --- |",
            "| 1 | 2 |",
            "",
            "After the table",
        ].join("\n"),
        expected: [
            {
                header: ["A", "B"],
                alignments: [null, null],
                rows: [["1", "2"]],
                startLine: 2,
                endLine: 4,
            },
        ],
    },
    {
        name: "long table with long cell values",
        input: [
            "| Row | Notes |",
            "| --- | --- |",
            ...Array.from({ length: 40 }, (_, index) => `| ${index + 1} | ${"long value ".repeat(12).trim()} ${index + 1} |`),
        ].join("\n"),
        expected: [
            {
                header: ["Row", "Notes"],
                alignments: [null, null],
                rows: Array.from({ length: 40 }, (_, index) => [
                    String(index + 1),
                    `${"long value ".repeat(12).trim()} ${index + 1}`,
                ]),
                startLine: 0,
                endLine: 41,
            },
        ],
    },
    {
        name: "long table tolerates blank lines between body rows",
        input: [
            "| Time | Event | Location | Notes |",
            "| --- | --- | --- | --- |",
            "| 08:30 | Deadline | - | Upload files. |",
            "",
            "| 09:30 | Lab | Room 1 | Bring scripts. |",
            "",
            "| 11:30 | Review | Online | Check comments. |",
            "",
            "Key prep notes",
        ].join("\n"),
        expected: [
            {
                header: ["Time", "Event", "Location", "Notes"],
                alignments: [null, null, null, null],
                rows: [
                    ["08:30", "Deadline", "-", "Upload files."],
                    ["09:30", "Lab", "Room 1", "Bring scripts."],
                    ["11:30", "Review", "Online", "Check comments."],
                ],
                startLine: 0,
                endLine: 6,
            },
        ],
    },
    {
        name: "long table keeps wrapped row continuation text",
        input: [
            "| Time | Event | Notes |",
            "| --- | --- | --- |",
            "| 08:30 | Deadline | Upload files.",
            "Verify the portal receipt before the next class.",
            "| 09:30 | Lab | Bring scripts. |",
            "After table",
        ].join("\n"),
        expected: [
            {
                header: ["Time", "Event", "Notes"],
                alignments: [null, null, null],
                rows: [
                    ["08:30", "Deadline", "Upload files.\nVerify the portal receipt before the next class."],
                    ["09:30", "Lab", "Bring scripts."],
                ],
                startLine: 0,
                endLine: 4,
            },
        ],
    },
    {
        name: "short rows are padded and extra cells are trimmed",
        input: [
            "| A | B | C |",
            "| --- | --- | --- |",
            "| 1 | 2 |",
            "| 3 | 4 | 5 | 6 |",
        ].join("\n"),
        expected: [
            {
                header: ["A", "B", "C"],
                alignments: [null, null, null],
                rows: [
                    ["1", "2", ""],
                    ["3", "4", "5"],
                ],
                startLine: 0,
                endLine: 3,
            },
        ],
    },
    {
        name: "fenced code exclusion",
        input: [
            "```",
            "| A | B |",
            "| --- | --- |",
            "| 1 | 2 |",
            "```",
        ].join("\n"),
        expected: [],
    },
    {
        name: "indented code exclusion",
        input: [
            "    | A | B |",
            "    | --- | --- |",
            "    | 1 | 2 |",
        ].join("\n"),
        expected: [],
    },
    {
        name: "malformed separator",
        input: [
            "| A | B |",
            "| --- | nope |",
            "| 1 | 2 |",
        ].join("\n"),
        expected: [],
    },
];

for (const fixture of fixtures) {
    assertDeepEqual(parseMarkdownTables(fixture.input), fixture.expected, fixture.name);
}

const blockFixtures = [
    {
        name: "raw replacement block stops before following text",
        input: [
            "| A | B |",
            "| --- | --- |",
            "| 1 | 2 |",
            "Following text",
        ].join("\n"),
        expected: {
            raw: [
                "| A | B |",
                "| --- | --- |",
                "| 1 | 2 |",
            ].join("\n"),
            table: {
                header: ["A", "B"],
                alignments: [null, null],
                rows: [["1", "2"]],
                startLine: 0,
                endLine: 2,
            },
        },
    },
    {
        name: "raw replacement block supports missing outer pipes",
        input: [
            "A | B",
            "--- | ---",
            "1 | 2",
            "",
            "Following text",
        ].join("\n"),
        expected: {
            raw: [
                "A | B",
                "--- | ---",
                "1 | 2",
            ].join("\n"),
            table: {
                header: ["A", "B"],
                alignments: [null, null],
                rows: [["1", "2"]],
                startLine: 0,
                endLine: 2,
            },
        },
    },
    {
        name: "raw replacement block rejects leading text",
        input: [
            "Before table",
            "| A | B |",
            "| --- | --- |",
            "| 1 | 2 |",
        ].join("\n"),
        expected: null,
    },
];

for (const fixture of blockFixtures) {
    assertDeepEqual(parseMarkdownTableBlock(fixture.input), fixture.expected, fixture.name);
}

const replacementFixtures = [
    {
        name: "replacement match preserves leading text without blank line",
        input: [
            "Before table",
            "| A | B |",
            "| --- | --- |",
            "| 1 | 2 |",
            "After table",
        ].join("\n"),
        expected: {
            raw: [
                "Before table",
                "| A | B |",
                "| --- | --- |",
                "| 1 | 2 |",
            ].join("\n"),
            leadingMarkdown: "Before table\n",
            tableRaw: [
                "| A | B |",
                "| --- | --- |",
                "| 1 | 2 |",
            ].join("\n"),
            table: {
                header: ["A", "B"],
                alignments: [null, null],
                rows: [["1", "2"]],
                startLine: 1,
                endLine: 3,
            },
        },
    },
    {
        name: "replacement match starts at table when no leading text exists",
        input: [
            "| A | B |",
            "| --- | --- |",
            "| 1 | 2 |",
        ].join("\n"),
        expected: {
            raw: [
                "| A | B |",
                "| --- | --- |",
                "| 1 | 2 |",
            ].join("\n"),
            leadingMarkdown: "",
            tableRaw: [
                "| A | B |",
                "| --- | --- |",
                "| 1 | 2 |",
            ].join("\n"),
            table: {
                header: ["A", "B"],
                alignments: [null, null],
                rows: [["1", "2"]],
                startLine: 0,
                endLine: 2,
            },
        },
    },
    {
        name: "replacement match ignores fenced tables and finds later real table",
        input: [
            "```",
            "| Ignored | Table |",
            "| --- | --- |",
            "| 1 | 2 |",
            "```",
            "| A | B |",
            "| --- | --- |",
            "| 3 | 4 |",
        ].join("\n"),
        expected: {
            raw: [
                "```",
                "| Ignored | Table |",
                "| --- | --- |",
                "| 1 | 2 |",
                "```",
                "| A | B |",
                "| --- | --- |",
                "| 3 | 4 |",
            ].join("\n"),
            leadingMarkdown: [
                "```",
                "| Ignored | Table |",
                "| --- | --- |",
                "| 1 | 2 |",
                "```",
                "",
            ].join("\n"),
            tableRaw: [
                "| A | B |",
                "| --- | --- |",
                "| 3 | 4 |",
            ].join("\n"),
            table: {
                header: ["A", "B"],
                alignments: [null, null],
                rows: [["3", "4"]],
                startLine: 5,
                endLine: 7,
            },
        },
    },
    {
        name: "replacement match supports rows-only continuation chunks",
        input: [
            "| 09:30 | Lab | Room 1 | Bring scripts. |",
            "| 11:30 | Review | Online | Check comments. |",
            "| 13:30 | Project | Room 2 | Send summary. |",
            "",
            "After table",
        ].join("\n"),
        expected: {
            raw: [
                "| 09:30 | Lab | Room 1 | Bring scripts. |",
                "| 11:30 | Review | Online | Check comments. |",
                "| 13:30 | Project | Room 2 | Send summary. |",
            ].join("\n"),
            leadingMarkdown: "",
            tableRaw: [
                "| 09:30 | Lab | Room 1 | Bring scripts. |",
                "| 11:30 | Review | Online | Check comments. |",
                "| 13:30 | Project | Room 2 | Send summary. |",
            ].join("\n"),
            table: {
                header: [],
                alignments: [null, null, null, null],
                rows: [
                    ["09:30", "Lab", "Room 1", "Bring scripts."],
                    ["11:30", "Review", "Online", "Check comments."],
                    ["13:30", "Project", "Room 2", "Send summary."],
                ],
                startLine: 0,
                endLine: 2,
            },
        },
    },
];

for (const fixture of replacementFixtures) {
    assertDeepEqual(parseMarkdownTableMatch(fixture.input), fixture.expected, fixture.name);
}
