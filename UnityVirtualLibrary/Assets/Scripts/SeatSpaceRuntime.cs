using System;
using System.Collections.Generic;
using System.Globalization;
using UnityEngine;
using UnityEngine.XR.Interaction.Toolkit;
using UnityEngine.XR.Interaction.Toolkit.Inputs;
using UnityEngine.XR.Interaction.Toolkit.Interactables;

public sealed class SeatSpaceRuntime : MonoBehaviour
{
    private SeatSpaceApiClient api;
    private ProceduralLibraryGenerator generator;
    private Camera viewCamera;
    private SeatSpacePlayerController player;
    private SeatInteractable selectedSeat;
    private XRInteractionManager xrInteractionManager;
    private GameObject xrRig;
    private GameObject xrSimulator;
    private GameObject xrSeatPanel;
    private TextMesh xrSeatDetails;
    private TextMesh xrBookLabel;
    private TextMesh xrCancelLabel;
    private TextMesh xrTimeLabel;
    private TextMesh xrDurationLabel;
    private bool xrCancelAwaitingConfirmation;
    private bool overviewVisible;
    private bool simulatedVrVisible;
    private bool hudVisible = true;
    private bool hudVisibleBeforeOverview = true;
    private string signInId = "";
    private string signInPassword = "";
    private string bookingStartInput;
    private int bookingDurationIndex = 1;
    private DateTimeOffset loadedAvailabilityStart;
    private DateTimeOffset loadedAvailabilityEnd;
    private string confirmCancelBookingId;
    private Vector3 savedPlayerPosition;
    private Quaternion savedPlayerRotation;
    private Vector3 savedCameraLocalPosition;
    private Quaternion savedCameraLocalRotation;
    private string statusMessage = "Loading the third-floor layout…";
    private const float PanelWidth = 360f;
    private static readonly int[] BookingDurationsMinutes = { 30, 60, 120, 180, 240 };

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
    private static void StartSeatSpace()
    {
        if (FindFirstObjectByType<SeatSpaceRuntime>() != null) return;
        var host = new GameObject("SeatSpace Virtual Library");
        DontDestroyOnLoad(host);
        host.AddComponent<SeatSpaceRuntime>();
    }

    private void Awake()
    {
        ConfigureSceneLighting();
        xrInteractionManager = gameObject.AddComponent<XRInteractionManager>();
        CreatePlayer();
        generator = new GameObject("Generated third-floor library").AddComponent<ProceduralLibraryGenerator>();
        generator.transform.SetParent(transform, false);
        api = gameObject.AddComponent<SeatSpaceApiClient>();
        api.LayoutLoaded += OnLayoutLoaded;
        api.AvailabilityLoaded += OnAvailabilityLoaded;
        api.MessageChanged += message => statusMessage = message;
        api.CheckSession();
        api.LoadLayout();
        InvokeRepeating(nameof(RefreshSeats), 30f, 30f);
        bookingStartInput = DateTime.Now.AddMinutes(15).ToString("yyyy-MM-dd HH:mm");
    }

    private void ConfigureSceneLighting()
    {
        foreach (var light in FindObjectsByType<Light>(FindObjectsSortMode.None)) light.enabled = false;
        RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
        RenderSettings.ambientLight = new Color(0.55f, 0.53f, 0.48f);
        RenderSettings.fog = false;
    }

    private void CreatePlayer()
    {
        foreach (var oldCamera in FindObjectsByType<Camera>(FindObjectsSortMode.None))
        {
            oldCamera.enabled = false;
            var oldListener = oldCamera.GetComponent<AudioListener>();
            if (oldListener != null) oldListener.enabled = false;
        }
        var root = new GameObject("Student explorer");
        root.transform.position = new Vector3(2.48f, 0.05f, -5.9f);
        var controller = root.AddComponent<CharacterController>();
        controller.height = 1.78f;
        controller.radius = 0.27f;
        controller.center = new Vector3(0f, 0.89f, 0f);
        controller.stepOffset = 0.28f;
        controller.slopeLimit = 45f;

        var cameraObject = new GameObject("First-person camera");
        cameraObject.transform.SetParent(root.transform, false);
        cameraObject.transform.localPosition = new Vector3(0f, 1.62f, 0f);
        viewCamera = cameraObject.AddComponent<Camera>();
        viewCamera.tag = "MainCamera";
        viewCamera.fieldOfView = 76f;
        viewCamera.nearClipPlane = 0.04f;
        viewCamera.farClipPlane = 180f;
        cameraObject.AddComponent<AudioListener>();
        player = root.AddComponent<SeatSpacePlayerController>();
        player.viewCamera = viewCamera;
    }

    private void OnLayoutLoaded(LibraryLayoutDocument document)
    {
        generator.Build(document);
        foreach (var seat in generator.Seats)
            seat.ConfigureXRInteraction(simulatedVrVisible, SelectSeatFromXR);
        Debug.Log("SeatSpace generated floor 3: " + document.tables.Length + " tables, " + generator.Seats.Count + " seats, "
            + (document.layout.walls == null ? 0 : document.layout.walls.Length) + " walls, "
            + (document.layout.doors == null ? 0 : document.layout.doors.Length) + " doors, "
            + (document.layout.shelves == null ? 0 : document.layout.shelves.Length) + " shelf rows.", this);
        if (document.layout.entrance != null && document.layout.entrance.pos != null && document.layout.entrance.pos.Length >= 2)
        {
            var entrance = document.layout.entrance.pos;
            // Layout Y increases downward in the approved plan; Unity's overhead camera shows +Z upward.
            player.transform.position = new Vector3(FindEntryCenter(document.layout.doors, entrance[0]), 0.05f, -entrance[1] - 1.3f);
            player.transform.rotation = Quaternion.Euler(0f, 180f, 0f);
        }
        RefreshSeats();
    }

    private static float FindEntryCenter(DoorLayout[] doors, float fallback)
    {
        var sum = 0f;
        var count = 0;
        foreach (var door in doors ?? new DoorLayout[0])
        {
            if (door.id == null || !door.id.StartsWith("entry")) continue;
            sum += door.x;
            count++;
        }
        return count == 0 ? fallback : sum / count;
    }

    private void RefreshSeats()
    {
        if (api != null) api.RefreshAvailability();
    }

    private void OnAvailabilityLoaded(SeatStatus[] statuses)
    {
        loadedAvailabilityStart = api.AvailabilityStartAt;
        loadedAvailabilityEnd = api.AvailabilityEndAt;
        var lookup = new Dictionary<string, SeatStatus>();
        foreach (var item in statuses)
            if (!string.IsNullOrEmpty(item.seatId)) lookup[item.seatId] = item;
        foreach (var seat in generator.Seats)
            seat.SetAvailability(lookup.TryGetValue(seat.SeatId, out var value) ? value : null);
    }

    private void Update()
    {
        if (simulatedVrVisible) UpdateXRSeatPanel();
        if (Input.GetKeyDown(KeyCode.F8)) SetSimulatedVR(!simulatedVrVisible);
        if (Input.GetKeyDown(KeyCode.M)) SetOverview(!overviewVisible);
        // H belongs to the XR Device Simulator's hand/controller-mode action.
        // Use F1 for the SeatSpace HUD toggle to avoid overlapping controls.
        if (Input.GetKeyDown(KeyCode.F1)) hudVisible = !hudVisible;
        if (simulatedVrVisible || !Input.GetMouseButtonDown(0) || viewCamera == null || generator == null) return;
        if (Input.mousePosition.x > Screen.width - PanelWidth - 24f) return;
        var ray = viewCamera.ScreenPointToRay(Input.mousePosition);
        if (!Physics.Raycast(ray, out var hit, 80f)) return;
        var seat = hit.collider.GetComponentInParent<SeatInteractable>();
        if (seat == null)
        {
            SelectSeat(null);
            return;
        }
        if (!seat.CanSelect)
        {
            statusMessage = seat.SeatId + " is " + seat.Status + " for the displayed time.";
            return;
        }
        SelectSeat(seat);
    }

    private void SelectSeat(SeatInteractable seat)
    {
        if (selectedSeat != null) selectedSeat.SetSelected(false);
        selectedSeat = seat;
        xrCancelAwaitingConfirmation = false;
        if (selectedSeat != null)
        {
            selectedSeat.SetSelected(true);
            statusMessage = selectedSeat.Status == "available"
                ? selectedSeat.SeatId + " is available. Choose Book to reserve it."
                : selectedSeat.SeatId + " availability is not confirmed yet (" + selectedSeat.Status + ").";
        }
    }

    private void SelectSeatFromXR(SeatInteractable seat)
    {
        if (seat != null && seat.CanSelect) SelectSeat(seat);
    }

    private void OnGUI()
    {
        if (!hudVisible)
        {
            if (overviewVisible)
                GUI.Label(new Rect(12f, 10f, 260f, 26f), "TOP-DOWN  ·  M return  ·  F1 controls", MutedStyle());
            return;
        }
        var x = Mathf.Max(12f, Screen.width - PanelWidth - 18f);
        GUILayout.BeginArea(new Rect(x, 16f, PanelWidth, Screen.height - 32f), GUI.skin.box);
        GUILayout.Label("SEATSPACE  /  VIRTUAL LIBRARY", HeaderStyle());
        GUILayout.Label("3rd Floor · procedural Unity scene", MutedStyle());
        GUILayout.Space(8f);
        GUILayout.Label(overviewVisible
            ? "Top-down validation view · click a chair to select"
            : "WASD walk · hold right mouse to look · click a chair to select", BodyStyle());
        GUILayout.Label("M toggles top-down view · F1 hides this panel", MutedStyle());
        if (!overviewVisible) GUILayout.Label("Shift to move faster · colliders keep you inside walkable spaces", MutedStyle());
        GUILayout.Space(10f);
        if (GUILayout.Button(simulatedVrVisible ? "Return to desktop mode (F8)" : "Enter simulated VR (F8)", GUILayout.Height(34f)))
            SetSimulatedVR(!simulatedVrVisible);
        if (simulatedVrVisible)
        {
            GUILayout.Label("XR Device Simulator controls", MutedStyle());
            GUILayout.Label("Hold right mouse and move mouse: rotate simulated head · WASD: move, Q/E: up/down", MutedStyle());
            GUILayout.Label("T / Y: manipulate left/right controller · hold Shift / Space and move mouse to aim", MutedStyle());
            GUILayout.Label("G: controller grip/select seat · left mouse: trigger/activate · Tab: cycle device · H: hand/controller mode", MutedStyle());
        }
        GUILayout.Space(6f);
        if (GUILayout.Button(overviewVisible ? "Return to walk mode" : "Show top-down layout")) SetOverview(!overviewVisible);
        if (GUILayout.Button("Refresh availability")) api.RefreshAvailability();
        GUILayout.Space(6f);
        if (selectedSeat != null)
        {
            GUILayout.Label("Selected seat", MutedStyle());
            GUILayout.Label(selectedSeat.SeatId, HeaderStyle());
            GUILayout.Label("Table: " + selectedSeat.TableId, MutedStyle());
            GUILayout.Label("Status for selected time: " + StatusLabel(selectedSeat.Status), BodyStyle());
            if (selectedSeat.Status == "booked")
                GUILayout.Label("Reserved " + FormatRange(selectedSeat.ReservationStartAt, selectedSeat.ReservationEndAt), MutedStyle());
            if (selectedSeat.Status == "occupied")
                GUILayout.Label("Checked in now " + FormatRange(selectedSeat.CurrentStartAt, selectedSeat.CurrentEndAt), MutedStyle());
            var owned = FindOwnedBooking(selectedSeat.SeatId);
            if (owned != null)
            {
                GUILayout.Label("Your reservation: " + FormatRange(owned.startAt, owned.endAt), MutedStyle());
                if (CanCancel(owned) && confirmCancelBookingId != owned.id)
                    if (GUILayout.Button("Cancel my reservation", GUILayout.Height(32f))) confirmCancelBookingId = owned.id;
            }
            GUILayout.Space(5f);
            GUILayout.Label("Reservation date and time (local)", MutedStyle());
            bookingStartInput = GUILayout.TextField(bookingStartInput ?? "", GUILayout.Height(28f));
            GUILayout.Label("Format: YYYY-MM-DD HH:MM", MutedStyle());
            bookingDurationIndex = GUILayout.SelectionGrid(bookingDurationIndex, new[] { "30m", "1h", "2h", "3h", "4h" }, 5);
            if (GUILayout.Button("Check availability for this time", GUILayout.Height(30f)))
            {
                if (TryGetBookingRange(out var chosenStart, out var chosenEnd)) api.RefreshAvailability(chosenStart, chosenEnd);
                else statusMessage = "Enter a valid future date and time in YYYY-MM-DD HH:MM format.";
            }
            var checkedWindow = TryGetBookingRange(out var start, out var end)
                && Math.Abs((loadedAvailabilityStart - start).TotalSeconds) < 1
                && Math.Abs((loadedAvailabilityEnd - end).TotalSeconds) < 1;
            GUI.enabled = !api.IsBusy && api.IsAuthenticated && selectedSeat.Status == "available" && checkedWindow;
            if (GUILayout.Button(api.IsBusy ? "Please wait…" : "Book this seat", GUILayout.Height(36f)))
                api.BookSeat(selectedSeat.SeatId, start, end);
            GUI.enabled = true;
            if (!api.IsAuthenticated) GUILayout.Label("Sign in below to reserve seats.", MutedStyle());
            else if (!checkedWindow) GUILayout.Label("Check availability for the chosen date and time before booking.", MutedStyle());
            else if (selectedSeat.Status != "available") GUILayout.Label("This seat cannot be booked for that interval.", MutedStyle());
            GUILayout.Space(4f);
            if (GUILayout.Button("Clear selection")) SelectSeat(null);
        }
        GUILayout.Space(10f);
        GUILayout.Label(api.IsAuthenticated ? "ACCOUNT" : "STUDENT SIGN IN", MutedStyle());
        if (!api.IsAuthenticated)
        {
            GUILayout.Label("USN or RVCE email", MutedStyle());
            signInId = GUILayout.TextField(signInId, GUILayout.Height(28f));
            signInPassword = GUILayout.PasswordField(signInPassword, '*', GUILayout.Height(28f));
            GUI.enabled = !api.IsBusy && !string.IsNullOrWhiteSpace(signInId) && !string.IsNullOrEmpty(signInPassword);
            if (GUILayout.Button(api.IsBusy ? "Please wait…" : "Sign in", GUILayout.Height(32f)))
            {
                api.SignIn(signInId, signInPassword);
                signInPassword = "";
            }
            GUI.enabled = true;
            GUILayout.Label("Create an account on the SeatSpace website first.", MutedStyle());
        }
        else
        {
            GUILayout.Label(api.CurrentUser.displayName + "  ·  " + api.CurrentUser.email, BodyStyle());
            if (GUILayout.Button("Refresh my bookings")) api.LoadMyBookings();
            foreach (var booking in api.MyBookings)
            {
                if (booking == null) continue;
                GUILayout.BeginHorizontal(GUI.skin.box);
                GUILayout.Label(booking.seatId + "  ·  " + booking.status, BodyStyle());
                if (CanCancel(booking))
                    if (GUILayout.Button("Cancel", GUILayout.Width(70f))) confirmCancelBookingId = booking.id;
                GUILayout.EndHorizontal();
            }
            if (!string.IsNullOrWhiteSpace(confirmCancelBookingId))
            {
                GUILayout.Label("Cancel this reservation? The seat will be released.", BodyStyle());
                GUILayout.BeginHorizontal();
                if (GUILayout.Button("Confirm cancellation"))
                {
                    api.CancelBooking(confirmCancelBookingId);
                    confirmCancelBookingId = null;
                }
                if (GUILayout.Button("Keep reservation")) confirmCancelBookingId = null;
                GUILayout.EndHorizontal();
            }
            if (GUILayout.Button("Sign out")) api.SignOut();
        }
        GUILayout.Space(8f);
        GUILayout.Label(statusMessage, BodyStyle());
        GUILayout.EndArea();
    }

    private static bool CanCancel(SeatSpaceBooking booking)
    {
        return booking != null
            && booking.status == "confirmed"
            && string.IsNullOrEmpty(booking.checkedInAt)
            && DateTime.TryParse(booking.endAt, out var endAt)
            && endAt.ToUniversalTime() > DateTime.UtcNow;
    }

    private SeatSpaceBooking FindOwnedBooking(string seatId)
    {
        foreach (var booking in api.MyBookings)
            if (booking != null && booking.seatId == seatId && CanCancel(booking)) return booking;
        return null;
    }

    private bool TryGetBookingRange(out DateTimeOffset start, out DateTimeOffset end)
    {
        start = default;
        end = default;
        if (!DateTime.TryParseExact(bookingStartInput, "yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture,
            DateTimeStyles.AssumeLocal, out var localStart)) return false;
        start = new DateTimeOffset(localStart.ToUniversalTime(), TimeSpan.Zero);
        end = start.AddMinutes(BookingDurationsMinutes[Mathf.Clamp(bookingDurationIndex, 0, BookingDurationsMinutes.Length - 1)]);
        return start > DateTimeOffset.UtcNow.AddMinutes(-1)
            && start <= DateTimeOffset.UtcNow.AddDays(30)
            && end - start <= TimeSpan.FromHours(4);
    }

    private static string StatusLabel(string status)
    {
        return status switch
        {
            "available" => "Available",
            "booked" => "Reserved for this time",
            "occupied" => "Occupied · checked in",
            "unavailable" => "Blocked / unavailable",
            _ => "Unknown"
        };
    }

    private static string FormatRange(string startText, string endText)
    {
        if (!DateTimeOffset.TryParse(startText, out var start) || !DateTimeOffset.TryParse(endText, out var end)) return "time unavailable";
        return start.LocalDateTime.ToString("MMM d, h:mm tt") + " – " + end.LocalDateTime.ToString("h:mm tt");
    }

    private void SetOverview(bool visible)
    {
        if (viewCamera == null || player == null || overviewVisible == visible) return;
        if (visible && simulatedVrVisible) SetSimulatedVR(false);
        overviewVisible = visible;
        if (visible)
        {
            hudVisibleBeforeOverview = hudVisible;
            hudVisible = false;
            savedPlayerPosition = player.transform.position;
            savedPlayerRotation = player.transform.rotation;
            savedCameraLocalPosition = viewCamera.transform.localPosition;
            savedCameraLocalRotation = viewCamera.transform.localRotation;
            player.enabled = false;
            viewCamera.transform.SetParent(null, true);
            viewCamera.orthographic = true;
            viewCamera.orthographicSize = 8.7f;
            viewCamera.transform.position = new Vector3(0f, 28f, 0.3f);
            viewCamera.transform.rotation = Quaternion.Euler(90f, 0f, 0f);
            statusMessage = "Top-down view matches the approved third-floor coordinate map. Press M to return.";
            return;
        }

        viewCamera.transform.SetParent(player.transform, false);
        viewCamera.transform.localPosition = savedCameraLocalPosition;
        viewCamera.transform.localRotation = savedCameraLocalRotation;
        viewCamera.orthographic = false;
        player.transform.position = savedPlayerPosition;
        player.transform.rotation = savedPlayerRotation;
        player.enabled = true;
        hudVisible = hudVisibleBeforeOverview;
        statusMessage = "Walk mode restored. Use WASD and hold right mouse to look.";
    }

    private void SetSimulatedVR(bool enabled)
    {
        if (simulatedVrVisible == enabled) return;
        if (enabled && overviewVisible) SetOverview(false);
        if (enabled)
        {
            var rigPrefab = Resources.Load<GameObject>("SeatSpaceXR/Starter Assets/Prefabs/XR Origin (XR Rig)");
            var simulatorPrefab = Resources.Load<GameObject>("SeatSpaceXR/XR Device Simulator/XR Device Simulator");
            if (rigPrefab == null || simulatorPrefab == null)
            {
                statusMessage = "The official XR Starter Assets or XR Device Simulator sample could not be loaded.";
                return;
            }

            var startPosition = player.transform.position;
            var startRotation = player.transform.rotation;
            player.enabled = false;
            viewCamera.enabled = false;
            var desktopListener = viewCamera.GetComponent<AudioListener>();
            if (desktopListener != null) desktopListener.enabled = false;

            xrRig = Instantiate(rigPrefab, startPosition, startRotation);
            DisableIncompleteSampleAffordanceSystems(xrRig);
            var xrCamera = xrRig.GetComponentInChildren<Camera>(true);
            if (xrCamera != null)
            {
                xrCamera.tag = "MainCamera";
                xrCamera.enabled = true;
            }
            var inputManager = xrRig.GetComponent<InputActionManager>();
            if (inputManager == null) inputManager = xrRig.AddComponent<InputActionManager>();
            if (inputManager.actionAssets == null || inputManager.actionAssets.Count == 0)
            {
                var actions = Resources.Load<UnityEngine.InputSystem.InputActionAsset>("SeatSpaceXR/Starter Assets/XRI Default Input Actions");
                if (actions != null) inputManager.actionAssets = new List<UnityEngine.InputSystem.InputActionAsset> { actions };
            }

            xrSimulator = Instantiate(simulatorPrefab);
            foreach (var seat in generator.Seats) seat.ConfigureXRInteraction(true, SelectSeatFromXR);
            if (xrCamera != null) CreateXRSeatPanel(xrCamera.transform);
            simulatedVrVisible = true;
            statusMessage = "XR simulator active. Aim with the simulated controller ray and select an available seat.";
            return;
        }

        foreach (var seat in generator.Seats) seat.ConfigureXRInteraction(false, SelectSeatFromXR);
        if (xrSeatPanel != null) Destroy(xrSeatPanel);
        xrSeatPanel = null;
        xrSeatDetails = null;
        xrBookLabel = null;
        xrCancelLabel = null;
        xrTimeLabel = null;
        xrDurationLabel = null;
        if (xrSimulator != null) Destroy(xrSimulator);
        if (xrRig != null) Destroy(xrRig);
        xrSimulator = null;
        xrRig = null;
        if (viewCamera != null)
        {
            viewCamera.tag = "MainCamera";
            viewCamera.enabled = true;
            var desktopListener = viewCamera.GetComponent<AudioListener>();
            if (desktopListener != null) desktopListener.enabled = true;
        }
        if (player != null) player.enabled = true;
        simulatedVrVisible = false;
        statusMessage = "Desktop mode restored. Use WASD and hold right mouse to look.";
    }

    private static GUIStyle HeaderStyle()
    {
        return new GUIStyle(GUI.skin.label) { fontSize = 18, fontStyle = FontStyle.Bold, wordWrap = true };
    }

    private void CreateXRSeatPanel(Transform cameraTransform)
    {
        xrSeatPanel = new GameObject("SeatSpace XR booking panel");
        xrSeatPanel.transform.SetParent(cameraTransform, false);
        xrSeatPanel.transform.localPosition = new Vector3(0.48f, -0.05f, 1.0f);

        var background = GameObject.CreatePrimitive(PrimitiveType.Cube);
        background.name = "Seat details panel background";
        background.transform.SetParent(xrSeatPanel.transform, false);
        background.transform.localScale = new Vector3(0.74f, 0.98f, 0.025f);
        background.transform.localPosition = new Vector3(0f, 0f, 0f);
        background.GetComponent<Renderer>().material.color = new Color(0.035f, 0.055f, 0.085f, 0.96f);
        Destroy(background.GetComponent<Collider>());

        xrSeatDetails = CreateXRText("SeatSpace seat details", xrSeatPanel.transform, new Vector3(0f, 0.43f, 0.02f), 0.025f, TextAnchor.UpperLeft);
        CreateXRButton("Start −15m", xrSeatPanel.transform, new Vector3(-0.16f, 0.12f, 0.045f), () => AdjustBookingStart(-15), new Vector2(0.29f, 0.07f));
        CreateXRButton("Start +15m", xrSeatPanel.transform, new Vector3(0.16f, 0.12f, 0.045f), () => AdjustBookingStart(15), new Vector2(0.29f, 0.07f));
        xrTimeLabel = CreateXRText("Selected booking time", xrSeatPanel.transform, new Vector3(0f, 0.045f, 0.025f), 0.023f, TextAnchor.MiddleCenter);
        CreateXRButton("Duration −", xrSeatPanel.transform, new Vector3(-0.16f, -0.045f, 0.045f), () => AdjustBookingDuration(-1), new Vector2(0.29f, 0.07f));
        CreateXRButton("Duration +", xrSeatPanel.transform, new Vector3(0.16f, -0.045f, 0.045f), () => AdjustBookingDuration(1), new Vector2(0.29f, 0.07f));
        xrDurationLabel = CreateXRText("Selected duration", xrSeatPanel.transform, new Vector3(0f, -0.12f, 0.025f), 0.023f, TextAnchor.MiddleCenter);
        CreateXRButton("Check chosen time", xrSeatPanel.transform, new Vector3(0f, -0.23f, 0.045f), HandleXRCheckAvailability);
        xrBookLabel = CreateXRButton("Book selected seat", xrSeatPanel.transform, new Vector3(0f, -0.34f, 0.045f), HandleXRBook);
        xrCancelLabel = CreateXRButton("Cancel my reservation", xrSeatPanel.transform, new Vector3(0f, -0.45f, 0.045f), HandleXRCancel);
    }

    private TextMesh CreateXRButton(string label, Transform parent, Vector3 position, Action action, Vector2? size = null)
    {
        var button = GameObject.CreatePrimitive(PrimitiveType.Cube);
        button.name = "XR action · " + label;
        button.transform.SetParent(parent, false);
        button.transform.localPosition = position;
        var buttonSize = size ?? new Vector2(0.62f, 0.085f);
        button.transform.localScale = new Vector3(buttonSize.x, buttonSize.y, 0.035f);
        button.GetComponent<Renderer>().material.color = new Color(0.10f, 0.29f, 0.46f);
        var interactable = button.AddComponent<XRSimpleInteractable>();
        interactable.selectEntered.AddListener(_ => action?.Invoke());
        var text = CreateXRText(label, button.transform, new Vector3(0f, 0f, 0.53f), 0.026f, TextAnchor.MiddleCenter);
        text.transform.localScale = new Vector3(1f, 1f, 0.2f);
        return text;
    }

    private static TextMesh CreateXRText(string label, Transform parent, Vector3 position, float size, TextAnchor anchor)
    {
        var textObject = new GameObject(label);
        textObject.transform.SetParent(parent, false);
        textObject.transform.localPosition = position;
        var text = textObject.AddComponent<TextMesh>();
        text.text = label;
        text.anchor = anchor;
        text.alignment = anchor == TextAnchor.UpperLeft ? TextAlignment.Left : TextAlignment.Center;
        text.fontSize = 48;
        text.characterSize = size;
        text.color = Color.white;
        return text;
    }

    private void UpdateXRSeatPanel()
    {
        if (xrSeatDetails == null) return;
        var details = "SEATSPACE · FLOOR 3\n";
        if (selectedSeat == null)
        {
            details += "Point at a chair and trigger to select it.\n\n" + statusMessage;
            xrBookLabel.text = "Book selected seat";
            xrCancelLabel.text = "Cancel my reservation";
            UpdateXRBookingLabels();
            return;
        }

        details += selectedSeat.SeatId + " · Table " + selectedSeat.TableId + "\n";
        details += StatusLabel(selectedSeat.Status) + "\n";
        if (selectedSeat.Status == "booked") details += FormatRange(selectedSeat.ReservationStartAt, selectedSeat.ReservationEndAt) + "\n";
        if (selectedSeat.Status == "occupied") details += "Checked in: " + FormatRange(selectedSeat.CurrentStartAt, selectedSeat.CurrentEndAt) + "\n";
        if (!api.IsAuthenticated) details += "Sign in in the account panel to book.\n";
        details += "\n" + statusMessage;
        xrSeatDetails.text = details;
        xrBookLabel.text = selectedSeat.Status == "available" ? "Book selected seat" : "Not available for this time";
        var owned = FindOwnedBooking(selectedSeat.SeatId);
        xrCancelLabel.text = owned == null ? "No cancellable booking" : (xrCancelAwaitingConfirmation ? "Confirm cancellation" : "Cancel my reservation");
        UpdateXRBookingLabels();
    }

    private void UpdateXRBookingLabels()
    {
        if (TryGetBookingRange(out var start, out _))
        {
            if (xrTimeLabel != null) xrTimeLabel.text = start.LocalDateTime.ToString("MMM d · h:mm tt");
        }
        if (xrDurationLabel != null)
            xrDurationLabel.text = BookingDurationsMinutes[Mathf.Clamp(bookingDurationIndex, 0, BookingDurationsMinutes.Length - 1)] + " min";
    }

    private void AdjustBookingStart(int minutes)
    {
        if (!DateTime.TryParseExact(bookingStartInput, "yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture,
            DateTimeStyles.AssumeLocal, out var localStart))
        {
            statusMessage = "Set the initial date and time in the desktop panel first.";
            return;
        }
        bookingStartInput = localStart.AddMinutes(minutes).ToString("yyyy-MM-dd HH:mm");
        statusMessage = "Time adjusted. Check availability before booking.";
    }

    private void AdjustBookingDuration(int direction)
    {
        bookingDurationIndex = Mathf.Clamp(bookingDurationIndex + direction, 0, BookingDurationsMinutes.Length - 1);
        statusMessage = "Duration set to " + BookingDurationsMinutes[bookingDurationIndex] + " minutes. Check availability before booking.";
    }

    private void HandleXRCheckAvailability()
    {
        if (TryGetBookingRange(out var start, out var end)) api.RefreshAvailability(start, end);
        else statusMessage = "Enter a valid date and time in the desktop panel first.";
    }

    private void HandleXRBook()
    {
        if (selectedSeat == null) { statusMessage = "Select an individual chair first."; return; }
        if (!api.IsAuthenticated) { statusMessage = "Sign in with your SeatSpace student account first."; return; }
        if (!TryGetBookingRange(out var start, out var end)) { statusMessage = "Set a valid date and time in the desktop panel first."; return; }
        var checkedWindow = Math.Abs((loadedAvailabilityStart - start).TotalSeconds) < 1
            && Math.Abs((loadedAvailabilityEnd - end).TotalSeconds) < 1;
        if (!checkedWindow) { statusMessage = "Check availability for the selected date and time first."; return; }
        if (selectedSeat.Status != "available") { statusMessage = "That seat is not available for the selected interval."; return; }
        api.BookSeat(selectedSeat.SeatId, start, end);
    }

    private void HandleXRCancel()
    {
        if (selectedSeat == null) { statusMessage = "Select the seat with your reservation first."; return; }
        var booking = FindOwnedBooking(selectedSeat.SeatId);
        if (booking == null) { statusMessage = "There is no cancellable reservation for this selected seat."; return; }
        if (!xrCancelAwaitingConfirmation)
        {
            xrCancelAwaitingConfirmation = true;
            statusMessage = "Aim at Confirm cancellation to release " + selectedSeat.SeatId + ".";
            return;
        }
        xrCancelAwaitingConfirmation = false;
        api.CancelBooking(booking.id);
    }

    private static void DisableIncompleteSampleAffordanceSystems(GameObject root)
    {
        // The bundled Starter Assets rig includes optional hand-poke affordance
        // providers whose theme references are absent in this desktop simulator
        // setup. Those sample-only providers spam NullReferenceExceptions every
        // frame; seat highlighting is handled independently by SeatInteractable.
        var disabled = 0;
        foreach (var component in root.GetComponentsInChildren<MonoBehaviour>(true))
        {
            var typeName = component.GetType().FullName ?? "";
            if (!typeName.StartsWith("UnityEngine.XR.Interaction.Toolkit.AffordanceSystem.", StringComparison.Ordinal)) continue;
            component.enabled = false;
            disabled++;
        }
        if (disabled > 0) Debug.Log($"Disabled {disabled} optional Starter Assets affordance components with missing themes.", root);
    }

    private static GUIStyle BodyStyle()
    {
        return new GUIStyle(GUI.skin.label) { fontSize = 14, wordWrap = true };
    }

    private static GUIStyle MutedStyle()
    {
        return new GUIStyle(GUI.skin.label) { fontSize = 12, wordWrap = true, normal = { textColor = new Color(0.72f, 0.76f, 0.82f) } };
    }
}
