# Unity desktop XR simulator status

## Project state

The existing project is at `UnityVirtualLibrary` and targets Unity `6000.3.29f1`. `Assets/Scenes/SampleScene.unity` is the only scene in the project and is the bootstrap scene; `SeatSpaceRuntime` generates the existing floor 3 from the backend layout (with the checked-in floor JSON as an offline fallback). It uses the included XR Device Simulator and XR Interaction Toolkit Starter Assets rather than a separate VR booking system. `SeatSpaceApiClient` calls the SeatSpace API for `/floors/3/layout`, availability, login/session, booking, the user's bookings, and cancellation.

On 24 November 2026, Play Mode generated **24 tables, 154 seats, 30 walls, 8 doors, and 9 shelf rows**. The live API health response was `api=ok`, `postgres=ok`, `mongodb=ok`; the layout endpoint returned floor 3 with 24 tables and 154 seats. After the local API started, Unity changed selected seat `T1-S3` from `unknown` to `available`, showing a live availability refresh. A mouse click in desktop/top-down mode selected `T1-S3` and displayed its ID and availability panel.

The generated scene continues to report the expected counts. During a later XR toggle, the Console reached 99+ errors: the repeated stack trace was an XRI `BaseAsyncAffordanceStateReceiver.HandleTween` null reference, accompanied by invalid-AABB / non-finite-view assertions. I added a runtime guard to disable optional Starter Assets affordance-system MonoBehaviours under the instantiated XR rig; on the fresh Play Mode/XR retest, the NRE/AABB spam did not recur. Two nonfatal haptic-capability warnings remain (`XRSimulatedController`, error code -1); XRI says it will assume one haptic channel. The current screenshot shows the top-down floor view in Play Mode with zero errors. The older Climb Teleport Arrow missing-Animator warning did not recur. Earlier Console entries also included nonfatal WebGL/sample cache warnings.

## Configured controls (asset inspection only)

These bindings were read from `Assets/Resources/SeatSpaceXR/XR Device Simulator/XR Device Simulator Controls.inputactions`. F8 entry/exit, F1 HUD hide/show, and keyboard-driven headset translation were observed in live Play Mode. The XR package's held mouse/controller bindings still need manual verification.

| Input | Configured action |
| --- | --- |
| Hold right mouse button and move mouse | Rotate the simulated head (not yet verified) |
| W/S, A/D | Translate on the simulator's Z/X axes (head translation was observed after keyboard input) |
| Q/E | Translate on the Y axis |
| T / Y | Choose left / right controller to manipulate |
| Hold Left Shift / Space and move mouse | Manipulate left / right controller |
| G | Simulated controller grip/select (the seat XR interactable uses Select) |
| Left mouse button | Simulated controller trigger/activate |
| Tab | Cycle simulated devices |
| H | Switch hand/controller mode |
| F8 | Enter or exit SeatSpace simulated VR |
| F1 | Hide or show the SeatSpace HUD |

The F1 change avoids a conflict: the previous SeatSpace HUD shortcut used H, which the simulator itself binds to hand/controller mode. `SeatSpaceRuntime.cs` now uses F1 and its HUD lists the package-configured controls. The XR Starter Assets bind seat selection to controller Grip/Select; the simulator maps that to G. Its left mouse binding is Trigger/Activate, so it must not be described as seat selection.

## Current verification boundary

- **Source/configuration checked:** XR Device Simulator prefab, input-action bindings, XR Origin prefab, procedural floor teleportation areas, seat `XRSimpleInteractable` setup, and API client route strings.
- **Live tested:** Unity opens normally; bootstrap scene generates the third-floor layout in Play Mode; F8 enters/exits simulator mode; XR Origin and simulator are instantiated; the fresh XR retest no longer emits the prior affordance NRE/AABB spam; F1 hides/restores the HUD; keyboard input moved the simulated headset; desktop click selected seat `T1-S3`; API health and floor-3 layout endpoints returned the live PostgreSQL-backed data; Unity availability refreshed to `available` after API startup; M displays the overhead layout.
- **Not verified:** mouse-held head rotation; simulated controller pose movement; controller ray selection of a seat; controller trigger; actual teleport execution/destination; Unity sign-in; Unity booking/cancellation; browser booking-state consistency during this run. The automation tool can tap a key but cannot hold a mouse button while moving the mouse, which is required by the package's controller/head manipulation bindings. Authentication and reservation UI actions also require a safe manual test session.
- **Prior blocker resolved:** Unity's Licensing Client now initializes, and the Editor is open. No Editor restart was needed for this continuation.
- **Service state:** PostgreSQL 18 service was already running. The existing startup script started the backend and Vite without resetting the database. API health and the floor layout endpoint subsequently returned successful responses.

## Resume checklist

1. Open Unity Hub, resolve its existing sign-in/licensing prompt, then open the existing `UnityVirtualLibrary` project with Unity `6000.3.29f1`.
2. Confirm the Console is free of compilation errors before entering Play Mode.
3. Start the existing PostgreSQL service and SeatSpace API/frontend using `start_seatspace.bat` from the project root; preserve the existing database and booking history.
4. Enter Play Mode, use F8 to enter simulated VR, and test the configured inputs above. Verify ray selection and teleportation separately.
5. Sign in with the existing development account, make a controlled test reservation, verify it through the existing website/database, then cancel it and verify the final status. Keep the resulting history; do not reset the database.

Record each control as tested only after observing its effect in Play Mode. A desktop simulation is not physical headset testing.
