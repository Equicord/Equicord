/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { CodeBlock } from "@components/CodeBlock";
import { classNameFactory } from "@utils/css";

import { DiscordHeading, DiscordText, Divider, InlineCode, Notice, Paragraph } from ".";

const cl = classNameFactory("vc-compfinder-");

export interface PropDef {
    name: string;
    type: string;
    default?: string;
    required?: boolean;
    internal?: boolean;
    description: string;
}

export interface DocNotice {
    type: "info" | "warn" | "danger" | "positive";
    children: React.ReactNode;
}

export interface DemoSection {
    title: string;
    description?: string;
    children: React.ReactNode;
    code?: string;
    relevantProps?: string[];
    notice?: DocNotice;
    id?: string;
}

export interface PropGroup {
    title: string;
    props: PropDef[];
}

export interface CodeExample {
    label: string;
    code: string;
}

export interface DocPageConfig {
    overview: string;
    importPath: string;
    sections?: DemoSection[];
    demos?: DemoSection[];
    props: PropDef[] | PropGroup[];
    examples?: CodeExample[];
    componentName?: string;
    notices?: DocNotice[];
    showToc?: boolean;
}

function isGrouped(props: PropDef[] | PropGroup[]): props is PropGroup[] {
    return props.length > 0 && "props" in props[0];
}

function allProps(props: PropDef[] | PropGroup[]): PropDef[] {
    return isGrouped(props) ? props.flatMap(g => g.props) : props;
}

function generateId(title: string): string {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function PropsTable({ props, showLegend }: { props: PropDef[]; showLegend?: boolean; }) {
    const hasRequired = props.some(p => p.required);
    const hasInternal = props.some(p => p.internal);
    return (
        <>
            <div className={cl("table-wrapper")}>
                <table className={cl("table")}>
                    <thead>
                        <tr>
                            <th>FIELD</th>
                            <th>TYPE</th>
                            <th>DEFAULT</th>
                            <th>DESCRIPTION</th>
                        </tr>
                    </thead>
                    <tbody>
                        {props.map(p => (
                            <tr key={p.name} className={p.required ? cl("table-row-required") : p.internal ? cl("table-row-internal") : undefined}>
                                <td>
                                    <span className={cl("table-field")}>{p.name}</span>
                                </td>
                                <td><InlineCode>{p.type}</InlineCode></td>
                                <td>{p.default ?? <span className={cl("table-dash")}>-</span>}</td>
                                <td className={cl("table-desc")}>{p.description}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {showLegend && (hasRequired || hasInternal) && (
                <div className={cl("table-legend")}>
                    {hasRequired && <span className={cl("table-legend-item")}><span className={cl("table-legend-bar", "table-legend-required")} /> Required</span>}
                    {hasInternal && <span className={cl("table-legend-item")}><span className={cl("table-legend-bar", "table-legend-internal")} /> Internal</span>}
                </div>
            )}
        </>
    );
}

function TableOfContents({ entries }: { entries: { id: string; label: string; }[]; }) {
    return (
        <div className={cl("toc")}>
            <DiscordText variant="text-xs/semibold" color="text-muted" className={cl("toc-label")}>
                ON THIS PAGE
            </DiscordText>
            <div className={cl("toc-links")}>
                {entries.map(entry => (
                    <a
                        key={entry.id}
                        className={cl("toc-link")}
                        href={`#${entry.id}`}
                        onClick={e => {
                            e.preventDefault();
                            document.getElementById(entry.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }}
                    >
                        {entry.label}
                    </a>
                ))}
            </div>
        </div>
    );
}

function MajorSection({ title, id, children }: { title: string; id: string; children: React.ReactNode; }) {
    return (
        <div id={id} className={cl("doc-section")}>
            <DiscordHeading variant="heading-lg/semibold" color="text-strong">{title}</DiscordHeading>
            {children}
        </div>
    );
}

function DemoSectionBlock({ section, relevantProps }: { section: DemoSection; relevantProps: PropDef[] | null; }) {
    const id = section.id ?? generateId(section.title);
    return (
        <div id={id} className={cl("doc-section")}>
            <DiscordHeading variant="heading-md/semibold" color="text-strong">{section.title}</DiscordHeading>
            {section.notice && (
                <Notice messageType={section.notice.type}>{section.notice.children}</Notice>
            )}
            {section.description && (
                <Paragraph color="text-muted">{section.description}</Paragraph>
            )}
            <div className={cl("doc-demo")}>
                {section.children}
            </div>
            {section.code && (
                <CodeBlock content={section.code} lang="tsx" />
            )}
            {relevantProps && (
                <div className={cl("doc-relevant-props")}>
                    <PropsTable props={relevantProps} />
                </div>
            )}
        </div>
    );
}

export function DocPage({ componentName, overview, importPath, sections, demos, props, examples, notices, showToc }: DocPageConfig) {
    const items = sections ?? demos ?? [];
    const flat = allProps(props);

    const tocEntries = [
        { id: "overview", label: "Overview" },
        { id: "import", label: "Import" },
        ...items.map(s => ({ id: s.id ?? generateId(s.title), label: s.title })),
        { id: "api-reference", label: "API Reference" },
        ...(examples?.length ? [{ id: "examples", label: "Examples" }] : []),
    ];

    const shouldShowToc = showToc ?? items.length >= 4;

    return (
        <div className={cl("doc-page")}>
            {componentName && (
                <DiscordHeading variant="heading-xl/bold" color="text-strong" className={cl("doc-title")}>
                    {componentName}
                </DiscordHeading>
            )}

            <div id="overview" className={cl("doc-section")}>
                <DiscordHeading variant="heading-lg/semibold" color="text-strong">Overview</DiscordHeading>
                <Paragraph color="text-muted">{overview}</Paragraph>
            </div>

            {notices?.map((notice, i) => (
                <Notice key={i} messageType={notice.type}>{notice.children}</Notice>
            ))}

            {shouldShowToc && <TableOfContents entries={tocEntries} />}

            <Divider />

            <div id="import" className={cl("doc-section")}>
                <div className={cl("import-block")}>
                    <DiscordText variant="text-xs/semibold" color="text-muted" className={cl("import-label")}>
                        IMPORT
                    </DiscordText>
                    <CodeBlock content={importPath} lang="tsx" />
                </div>
            </div>

            {items.map(section => {
                const relevant = section.relevantProps?.length
                    ? flat.filter(p => section.relevantProps!.includes(p.name))
                    : null;

                return [
                    <Divider key={`${section.title}-divider`} />,
                    <DemoSectionBlock key={section.title} section={section} relevantProps={relevant} />,
                ];
            })}

            <Divider />

            <MajorSection title="API Reference" id="api-reference">
                {isGrouped(props) ? (
                    props.map(group => (
                        <div key={group.title} className={cl("doc-prop-group")}>
                            <DiscordHeading variant="heading-md/medium" color="text-strong">
                                {group.title}
                            </DiscordHeading>
                            <PropsTable props={group.props} showLegend />
                        </div>
                    ))
                ) : (
                    <PropsTable props={props} showLegend />
                )}
            </MajorSection>

            {examples?.length ? (
                <>
                    <Divider />
                    <MajorSection title="Examples" id="examples">
                        {examples.map(ex => (
                            <div key={ex.label} className={cl("doc-example")}>
                                <Paragraph color="text-muted">{ex.label}</Paragraph>
                                <CodeBlock content={ex.code} lang="tsx" />
                            </div>
                        ))}
                    </MajorSection>
                </>
            ) : null}
        </div>
    );
}
