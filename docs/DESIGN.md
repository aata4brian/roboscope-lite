# Interface refresh — October 2026

The overview now uses light telemetry panels and a dark navigation rail. The three-step guide connects starting the simulator, injecting a fault and inspecting the latest incident. The connected-device label was corrected to “Simulated robot”.

Signal lines retain separate colors. Expected velocity and the received measurement remain separate; network gaps are still gaps. Desktop and mobile use the same controls and recording format.

Design references:
- [Tremor open-source dashboard](https://github.com/tremorlabs/template-dashboard-oss): clear metric hierarchy, panel spacing and restrained borders.
- [Grafana](https://github.com/grafana/grafana): signal-first panels, axes and adjacent status information.

The implementation is original CSS and existing React components. No template code or dependencies were copied.

Validation: 36 behavior tests, TypeScript, production build and 17 browser checks passed. Additional visual checks covered overview and replay at 1440, 1280, 768 and 390 px. The demo remains simulated telemetry; no physical robot validation is claimed.
