# Flat versioned verification

Public alpha.10 source 8310a9a had two red remote CI runs, 38020682057 and 38020684824. Both completed historical alpha.8 and the 78 alpha.9 guards, then stopped about 60 seconds into the original alpha.9 whole-web runner after partial passing TAP. Current r5 gates/web were never reached. This is the historical harness timeout diagnosis, not a passing prior CI or demonstrated r5 assertion failure.

## Execution ownership

Normal npm test runs each independent group once and preserves nonzero failure status while still obtaining the current product result. Archived npm pipelines and whole-web runners are no longer recursively invoked; their exact source bytes remain immutable.

- alpha.7: original check-provenance, check-weather-elapsed-boundary, contract and static identity files, 107 original tests
- alpha.8: original 74 release guards, original contract/API/static files, and every non-deduplicated historical web file listed below
- alpha.9: original 78 release guards, original contract/API/static files, and every non-deduplicated historical web file listed below
- current alpha.10: existing 25 release gates, vendor/contract/API/static groups, and all 43 current web files containing the full 423 web cases, each exactly once in the normal web group

Old gates retain their clean/mutated visible-text controls and r4 clean/known-negative endpoint controls. These nested controls are intentional gate assertions, not another current whole-web aggregate. The previously failed alpha.8 visible-text negative child and both alpha.8/alpha.9 card-projection history/intent files remain executable and fatal. No assertion, runtime, timeout threshold or expectation was edited to accept failure.

Each test-file shard has a 60,000 ms process limit; the complete CI job retains its 10-minute limit. There are no automatic retries or name filters. Every result prints and saves exit code, signal, original error code/message, duration, planned file and partial TAP. Results persist after every shard, and CI uploads evidence even on failure. Independent groups continue after a failure, but final exit remains nonzero. Timed historical/provenance/web shards retain full TAP artifacts. The untimed harness/vendor/current contract/API/static groups retain their output in the CI console and structured exit/error status in aggregate.json.

## Explicit deduplication

Only the following 18 original files per alpha.8/alpha.9 run once on current source instead of redundantly on each snapshot. Original/current test bytes and the shared module/fixture input set are checked equal before omission; any drift is a fatal assertion. The 201 shared input paths and complete classification are in provenance/verification-coverage.json. Named pure tests do not execute changed reader/surface inputs. The recorder checks unchanged HTML structure; only the independently checked revision title is normalized for equality.

Tests involving changed reader/host/world assembly or historical dispatch are conservatively retained, even when their test-file bytes alone are equal. Current runtime's exact release hashes remain independently checked.

- apps/web/tests/integration/accepted-send.test.mjs: unchanged accepted chat send modules and fixed continuity fixtures
- apps/web/tests/integration/bfcache.test.mjs: unchanged chat pageshow and turn-scroll code
- apps/web/tests/integration/compact-feed-baseline.test.mjs: fixed alpha.2 fixture only, not active reader
- apps/web/tests/integration/flow-owner.test.mjs: unchanged chat flow/page-lock modules and synthetic fixture
- apps/web/tests/integration/hidden-source.test.mjs: unchanged chat layout/page-lock and hidden-owner code
- apps/web/tests/integration/recorder.test.mjs: unchanged diagnostics module; HTML differs only in separately checked title
- apps/web/tests/integration/story-geometry-props.test.mjs: unchanged Three.js/story geometry and prop modules
- apps/web/tests/integration/story-geometry.test.mjs: unchanged Three.js/story geometry module
- apps/web/tests/integration/weather-overlay.test.mjs: unchanged weather module and fixed overlay fixtures
- apps/web/tests/integration/weather-solar-baseline.test.mjs: fixed alpha.3 weather fixtures only
- apps/web/tests/integration/weather-solar.test.mjs: unchanged weather module and solar fixture
- apps/web/tests/menu-port/menu.test.mjs: unchanged menu module and synthetic DOM fixture
- apps/web/tests/weather-port/weather.test.mjs: unchanged weather/clock modules and synthetic Three.js scene
- apps/web/tests/weather-v5/model-parity.test.mjs: unchanged weather model and fixed alpha.4 control
- apps/web/tests/weather-v5/phase-continuity.test.mjs: unchanged weather effect and fixed v2 control
- apps/web/tests/weather-v5/retarget-continuity.test.mjs: unchanged weather effect and fixed v3 control
- apps/web/tests/weather-v5/weather-solar.test.mjs: unchanged weather module and solar fixture
- apps/web/tests/weather-v5/weather.test.mjs: unchanged weather/clock modules and synthetic Three.js scene

Original vendor tests run once on current source after test/setup source, vendor provenance and generated bytes are proven equal. Historical contract/API/static groups are not deduplicated because their identities differ.

## alpha8 retained historical web shards

- apps/web/tests/integration/card-projection.test.mjs
- apps/web/tests/integration/chat-world.test.mjs
- apps/web/tests/integration/compact-feed.test.mjs
- apps/web/tests/integration/content-host.test.mjs
- apps/web/tests/integration/host-navigation.test.mjs
- apps/web/tests/integration/integration-contract.test.mjs
- apps/web/tests/integration/module-bootstrap.test.mjs
- apps/web/tests/integration/motion-clock.test.mjs
- apps/web/tests/integration/reader-scroll-ownership.test.mjs
- apps/web/tests/integration/reader-visible-text.test.mjs
- apps/web/tests/integration/reading-assistant.test.mjs
- apps/web/tests/integration/replay-scroll.test.mjs
- apps/web/tests/integration/scroll-source.test.mjs
- apps/web/tests/integration/shadow-cache-boundary.test.mjs
- apps/web/tests/integration/shadow-cache.test.mjs
- apps/web/tests/integration/story-contract.test.mjs
- apps/web/tests/integration/temporal-close.test.mjs
- apps/web/tests/integration/world-cpu.test.mjs
- apps/web/tests/integration/world-layers.test.mjs
- apps/web/tests/weather-elapsed/elapsed.test.mjs
- apps/web/tests/weather-v5/assembly.test.mjs
- apps/web/tests/weather-v5/readable-weather.test.mjs
- apps/web/tests/weather-v5/reading-protection.test.mjs

## alpha9 retained historical web shards

- apps/web/tests/integration/card-projection.test.mjs
- apps/web/tests/integration/chat-world.test.mjs
- apps/web/tests/integration/compact-feed.test.mjs
- apps/web/tests/integration/content-host.test.mjs
- apps/web/tests/integration/host-navigation.test.mjs
- apps/web/tests/integration/integration-contract.test.mjs
- apps/web/tests/integration/module-bootstrap.test.mjs
- apps/web/tests/integration/motion-clock.test.mjs
- apps/web/tests/integration/reader-endpoint-continuity.test.mjs
- apps/web/tests/integration/reader-scroll-ownership.test.mjs
- apps/web/tests/integration/reader-visible-text.test.mjs
- apps/web/tests/integration/reading-assistant.test.mjs
- apps/web/tests/integration/replay-scroll.test.mjs
- apps/web/tests/integration/scroll-source.test.mjs
- apps/web/tests/integration/shadow-cache-boundary.test.mjs
- apps/web/tests/integration/shadow-cache.test.mjs
- apps/web/tests/integration/story-contract.test.mjs
- apps/web/tests/integration/temporal-close.test.mjs
- apps/web/tests/integration/world-cpu.test.mjs
- apps/web/tests/integration/world-layers.test.mjs
- apps/web/tests/weather-elapsed/elapsed.test.mjs
- apps/web/tests/weather-v5/assembly.test.mjs
- apps/web/tests/weather-v5/readable-weather.test.mjs
- apps/web/tests/weather-v5/reading-protection.test.mjs

Original failed remote logs remain in the release investigation evidence. New CI is evaluated on its new exact commit. This change neither modifies nor republishes the 73-file product runtime and establishes no browser/device/performance acceptance.
