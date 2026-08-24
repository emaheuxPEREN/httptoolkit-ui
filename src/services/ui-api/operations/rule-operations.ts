import { Operation } from '../api-types';
import { RulesStore } from '../../../model/rules/rules-store';
import { mapRules } from '../../../model/rules/rules-structure';
import { summarizeMatcher, summarizeSteps } from '../../../model/rules/rule-descriptions';

export function registerRuleOperations(
    registry: { register(op: Operation): void },
    rulesStore: RulesStore
): void {
    registry.register(rulesListOperation(rulesStore));
}

function rulesListOperation(rulesStore: RulesStore): Operation {
    return {
        definition: {
            name: 'rules.list',
            description: 'List the currently configured HTTP Toolkit rules, which define how ' +
                'matching traffic is mocked, rewritten, breakpointed or otherwise modified. ' +
                'Rules are listed in priority order, and each is summarized rather than returning ' +
                'its full configuration.',
            category: 'rules',
            tiers: ['pro'],
            annotations: { readOnlyHint: true },
            inputSchema: {
                type: 'object',
                properties: {}
            },
            outputSchema: {
                type: 'object',
                properties: {
                    rules: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                id: { type: 'string' },
                                type: {
                                    type: 'string',
                                    description: 'The rule protocol, e.g. "http" or "websocket"'
                                },
                                title: {
                                    type: 'string',
                                    description: 'The rule\'s user-defined title, if it has one'
                                },
                                activated: {
                                    type: 'boolean',
                                    description: 'Whether the rule is currently enabled'
                                },
                                matches: {
                                    type: 'string',
                                    description: 'Human-readable summary of the traffic this rule matches'
                                },
                                steps: {
                                    type: 'string',
                                    description: 'Human-readable summary of what this rule does when matched'
                                }
                            }
                        }
                    },
                    unsavedChanges: {
                        type: 'boolean',
                        description: 'Whether the rules shown include edits that are not yet ' +
                            'saved in the UI, and so are not yet affecting live traffic'
                    }
                }
            }
        },
        handler: async () => {
            const rules = mapRules(rulesStore.draftRules, (rule) => ({
                id: rule.id,
                type: rule.type,
                title: rule.title,
                activated: rule.activated,
                matches: summarizeMatcher(rule),
                steps: summarizeSteps(rule)
            }));

            return {
                success: true,
                data: {
                    rules,
                    unsavedChanges: rulesStore.areSomeRulesUnsaved
                }
            };
        }
    };
}
