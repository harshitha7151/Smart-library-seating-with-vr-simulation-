# SeatSpace virtual library

Unity 6.3 project for the existing third-floor SeatSpace model.

## Open it

In Unity Hub, choose **Projects → Add → Add project from disk**, then select the `UnityVirtualLibrary` folder. Open it with Unity **6000.3.29f1**. Unity will import packages the first time.

If you update `src/scene3DData.js`, return to the SeatSpace project folder and run:

```text
npm run unity:export-layout
```

This updates `Assets/StreamingAssets/seatspace-floor3.json`. Do not edit that generated JSON by hand; the React Three.js map is the layout source.

## Run the scene

Open `Assets/Scenes/SampleScene.unity` and press **Play**. The runtime creates the library from the saved layout, then asks the Express API for the live floor data and seat statuses. If the API is unavailable, it uses the generated file for geometry but does not mark seats bookable.

- **WASD:** walk
- **Hold right mouse button:** look around
- **Click a blue chair:** select it
- **M:** switch between the overhead orthographic plan and walk mode
- **F8:** enter or leave the desktop XR simulator
- **H:** hide or show the runtime panel
- **Refresh availability:** update statuses
- **Book this seat for one hour:** send the reservation to the existing SeatSpace API

Unity should run from the same machine or website host as SeatSpace. The initial Editor default uses the Vite server at `http://127.0.0.1:5181/api`; the WebGL player uses the website's own origin and `/api` proxy.

## Build the React WebGL player

After Unity imports packages and successfully compiles the project, choose **SeatSpace → Build WebGL for React**. The output goes to the existing app's `public/unity/` folder. The React **Virtual library** page detects that output and embeds it. The `public/unity/` contents are generated build files.

The Unity WebGL build targets desktop browsers. Unity OpenXR is configured as a future native-player path; no physical headset is available or tested.

## Safe Mode repair status

The Unity 6.3 Editor compiled all project scripts with zero Console errors after updating Input System to 1.20.1 and enabling Unity's built-in `com.unity.modules.unitywebrequest` module. These fixed the `BuildTarget.ReservedCFE` and missing `UnityWebRequest` compiler errors. Unity upgraded the PC and Mobile URP pipeline assets; originals are backed up outside the Unity project under `../tmp/seatspace-safe-mode-backup/Assets/Settings/`.

The Editor has since been run normally. The runtime generated 24 tables, 154 seats, 30 walls, 8 door frames and 9 shelf rows. The overhead camera is orthographic and now reflects the shared layout's screen-down Y axis into Unity's world Z so the left patio, lower book wing, central reception and right garden align with the approved image. Table IDs and source coordinates remain unchanged. The layout was visually inspected in Play Mode, but this is not a pixel-perfect match: current Unity text/furniture detail and exact colors still differ from the illustrative reference. The Unity Project Settings validator still displays two XR configuration warnings (background input and teleportation interaction layer). The Console showed no compile errors during the latest run. The XR simulator was entered and exited; controller seat selection, teleporting and live API booking were not verified. The API was offline during the runtime preview, so Unity used its generated third-floor layout fallback and did not confirm bookable live status. The Input Manager deprecation message remains because desktop navigation uses Unity's legacy `Input` API.

This Unity project implements only the third floor. It has no fourth-floor scene or floor selector. In Play Mode, the XR simulator is a desktop test path, not proof of headset support. Its official simulator prefab provides the on-screen keyboard/mouse controls; a real headset has not been tested.
