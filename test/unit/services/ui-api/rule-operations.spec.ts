import * as _ from 'lodash';
import { reaction } from 'mobx';
import { completionCheckers } from 'mockttp';

import { expect } from '../../../test-setup';

import { OperationRegistry } from '../../../../src/services/ui-api/api-registry';
import { registerRuleOperations } from '../../../../src/services/ui-api/operations/rule-operations';
import { RulesStore } from '../../../../src/model/rules/rules-store';
import { HtkRule, RulePriority } from '../../../../src/model/rules/rules';
import { flattenRules, HtkRuleRoot } from '../../../../src/model/rules/rules-structure';
import {
    WildcardMatcher,
    StaticResponseStep,
    PassThroughStep
} from '../../../../src/model/rules/definitions/http-rule-definitions';
import {
    RTCWildcardMatcher,
    DynamicProxyStep
} from '../../../../src/model/rules/definitions/rtc-rule-definitions';

const buildRule = (
    id: string,
    step: HtkRule['steps'][number],
    priority?: RulePriority
): HtkRule => ({
    id,
    type: 'http',
    activated: true,
    ...(priority !== undefined ? { priority } : {}),
    matchers: [new WildcardMatcher()],
    steps: [step],
    completionChecker: new completionCheckers.Always()
}) as HtkRule;

describe("Rule API operations", () => {

    let store: RulesStore;
    let registry: OperationRegistry;

    // root
    // |- mock-rule
    // \- a-group
    //    |- grouped-rule
    //    \- nested-group
    //       \- nested-rule
    beforeEach(() => {
        const proxyStore = {
            serverVersion: '1.0.0',
            dnsServers: [],
            httpProxyPort: 8000,
            ruleParameterKeys: []
        };
        store = new RulesStore({ featureFlags: [] } as any, proxyStore as any, null as any);

        store.rules = {
            id: 'root',
            title: 'HTTP Toolkit Rules',
            isRoot: true,
            items: [
                buildRule('mock-rule', new StaticResponseStep(200)),
                {
                    id: 'a-group',
                    title: 'A group',
                    items: [
                        buildRule('grouped-rule', new PassThroughStep(store)),
                        {
                            id: 'nested-group',
                            title: 'Nested group',
                            items: [buildRule('nested-rule', new StaticResponseStep(404))]
                        }
                    ]
                }
            ]
        } as HtkRuleRoot;
        store.draftRules = _.cloneDeep(store.rules);

        registry = new OperationRegistry(() => true);
        registerRuleOperations(registry, store);
    });

    const listRules = async () => {
        const result = await registry.execute('rules.list', {});
        expect(result.success).to.equal(true);
        return result.data as { rules: any[], unsavedChanges: boolean };
    };

    describe("rules.list", () => {
        it("summarizes every rule, nested within its groups", async () => {
            const data = await listRules();

            expect(data).to.deep.equal({
                rules: [
                    {
                        id: 'mock-rule',
                        type: 'http',
                        activated: true,
                        priority: RulePriority.DEFAULT,
                        matches: 'Any requests',
                        steps: 'Respond with status 200'
                    },
                    {
                        id: 'a-group',
                        title: 'A group',
                        rules: [
                            {
                                id: 'grouped-rule',
                                type: 'http',
                                activated: true,
                                priority: RulePriority.DEFAULT,
                                matches: 'Any requests',
                                steps: 'Pass the request through to the target host'
                            },
                            {
                                id: 'nested-group',
                                title: 'Nested group',
                                rules: [
                                    {
                                        id: 'nested-rule',
                                        type: 'http',
                                        activated: true,
                                        priority: RulePriority.DEFAULT,
                                        matches: 'Any requests',
                                        steps: 'Respond with status 404'
                                    }
                                ]
                            }
                        ]
                    }
                ],
                unsavedChanges: false
            });
        });

        it("reports the explicit priority of high-priority rules", async () => {
            store.draftRules.items.unshift(
                buildRule('override-rule', new StaticResponseStep(200), RulePriority.OVERRIDE)
            );

            const data = await listRules();

            expect(data.rules[0].id).to.equal('override-rule');
            expect(data.rules[0].priority).to.equal(2);
        });

        it("omits priority for WebRTC rules, which are matched separately", async () => {
            store.draftRules.items.push({
                id: 'rtc-rule',
                type: 'webrtc',
                activated: true,
                matchers: [new RTCWildcardMatcher()],
                steps: [new DynamicProxyStep()]
            } as any);

            const data = await listRules();
            const rtcRule = data.rules.find((r: any) => r.id === 'rtc-rule');

            expect(rtcRule.type).to.equal('webrtc');
            expect(rtcRule).to.not.have.property('priority');
        });

        it("reports deactivated rules", async () => {
            (store.draftRules.items[0] as HtkRule).activated = false;

            const data = await listRules();

            expect(data.rules[0].activated).to.equal(false);
        });

        it("reports unsaved draft changes", async () => {
            store.draftRules.items.pop();

            const data = await listRules();

            expect(data.unsavedChanges).to.equal(true);
        });

        it("requires a paid account", async () => {
            const freeRegistry = new OperationRegistry(() => false);
            registerRuleOperations(freeRegistry, store);

            const result = await freeRegistry.execute('rules.list', {});

            expect(result.success).to.equal(false);
            expect(result.error!.code).to.equal('TIER_REQUIRED_PRO');
        });
    });

});
