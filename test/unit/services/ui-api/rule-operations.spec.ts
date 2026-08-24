import * as _ from 'lodash';
import { completionCheckers } from 'mockttp';

import { expect } from '../../../test-setup';

import { OperationRegistry } from '../../../../src/services/ui-api/api-registry';
import { registerRuleOperations } from '../../../../src/services/ui-api/operations/rule-operations';
import { RulesStore } from '../../../../src/model/rules/rules-store';
import { HtkRule } from '../../../../src/model/rules/rules';
import { HtkRuleRoot } from '../../../../src/model/rules/rules-structure';
import {
    WildcardMatcher,
    StaticResponseStep,
    PassThroughStep
} from '../../../../src/model/rules/definitions/http-rule-definitions';

const buildRule = (id: string, step: HtkRule['steps'][number]): HtkRule => ({
    id,
    type: 'http',
    activated: true,
    matchers: [new WildcardMatcher()],
    steps: [step],
    completionChecker: new completionCheckers.Always()
}) as HtkRule;

describe("Rule API operations", () => {

    let store: RulesStore;
    let registry: OperationRegistry;

    beforeEach(() => {
        const proxyStore = {
            serverVersion: '1.0.0',
            dnsServers: [],
            httpProxyPort: 8000,
            ruleParameterKeys: []
        };
        store = new RulesStore({ featureFlags: [] } as any, proxyStore as any, null as any);

        const mockRule = buildRule('mock-rule', new StaticResponseStep(200));
        const groupedRule = buildRule('grouped-rule', new PassThroughStep(store));

        store.rules = {
            id: 'root',
            title: 'HTTP Toolkit Rules',
            isRoot: true,
            items: [
                mockRule,
                {
                    id: 'a-group',
                    title: 'A group',
                    items: [groupedRule]
                }
            ]
        } as HtkRuleRoot;
        store.draftRules = _.cloneDeep(store.rules);

        registry = new OperationRegistry(() => true);
        registerRuleOperations(registry, store);
    });

    describe("rules.list", () => {
        it("summarizes every rule, including rules within groups", async () => {
            const result = await registry.execute('rules.list', {});

            expect(result.success).to.equal(true);
            expect(result.data).to.deep.equal({
                rules: [
                    {
                        id: 'mock-rule',
                        type: 'http',
                        activated: true,
                        matches: 'Any requests',
                        steps: 'Respond with status 200'
                    },
                    {
                        id: 'grouped-rule',
                        type: 'http',
                        activated: true,
                        matches: 'Any requests',
                        steps: 'Pass the request through to the target host'
                    }
                ],
                unsavedChanges: false
            });
        });

        it("reports deactivated rules", async () => {
            (store.draftRules.items[0] as HtkRule).activated = false;

            const result = await registry.execute('rules.list', {});

            expect((result.data as any).rules.map((r: any) => r.activated))
                .to.deep.equal([false, true]);
        });

        it("reports unsaved draft changes", async () => {
            store.draftRules.items.pop();

            const result = await registry.execute('rules.list', {});

            expect(result.success).to.equal(true);
            expect((result.data as any).unsavedChanges).to.equal(true);
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
