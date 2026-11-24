using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using UnityEngine;
using UnityEngine.Networking;

public sealed class SeatSpaceApiClient : MonoBehaviour
{
    [Tooltip("Leave empty to use the website's own origin in WebGL, or Vite on port 5181 in the Editor.")]
    public string apiRoot = "";

    public event Action<LibraryLayoutDocument> LayoutLoaded;
    public event Action<SeatStatus[]> AvailabilityLoaded;
    public event Action<string> MessageChanged;
    public event Action<string> BookingCompleted;
    public event Action<SeatSpaceBooking[]> BookingsLoaded;

    private bool loadingLayout;
    private bool loadingAvailability;
    private bool bookingInProgress;
    private bool accountRequestInProgress;
    private string sessionCookie = "";
    public DateTimeOffset AvailabilityStartAt { get; private set; }
    public DateTimeOffset AvailabilityEndAt { get; private set; }
    private bool hasRequestedAvailabilityWindow;
    public SeatSpaceUser CurrentUser { get; private set; }
    public SeatSpaceBooking[] MyBookings { get; private set; } = new SeatSpaceBooking[0];
    public bool IsAuthenticated => CurrentUser != null;
    public bool IsBusy => loadingLayout || loadingAvailability || bookingInProgress || accountRequestInProgress;

    private string ApiRoot
    {
        get
        {
            if (!string.IsNullOrWhiteSpace(apiRoot)) return apiRoot.TrimEnd('/');
            if (Uri.TryCreate(Application.absoluteURL, UriKind.Absolute, out var page))
                return page.GetLeftPart(UriPartial.Authority) + "/api";
            return "http://127.0.0.1:5181/api";
        }
    }

    public void LoadLayout()
    {
        if (!loadingLayout) StartCoroutine(GetLayout());
    }

    public void RefreshAvailability()
    {
        if (hasRequestedAvailabilityWindow)
        {
            RefreshAvailability(AvailabilityStartAt, AvailabilityEndAt);
            return;
        }
        var now = DateTimeOffset.UtcNow;
        RefreshAvailability(now, now.AddHours(2));
    }

    public void RefreshAvailability(DateTimeOffset startAt, DateTimeOffset endAt)
    {
        if (loadingAvailability || endAt <= startAt || endAt - startAt > TimeSpan.FromHours(4)) return;
        AvailabilityStartAt = startAt;
        AvailabilityEndAt = endAt;
        hasRequestedAvailabilityWindow = true;
        StartCoroutine(GetAvailability(startAt, endAt));
    }

    public void BookSeat(string seatId, DateTimeOffset startAt, DateTimeOffset endAt)
    {
        if (!IsAuthenticated)
        {
            MessageChanged?.Invoke("Sign in with your SeatSpace account before booking from Unity.");
            return;
        }
        if (!bookingInProgress) StartCoroutine(CreateBooking(seatId, startAt, endAt));
    }

    public void SignIn(string loginId, string password)
    {
        if (!accountRequestInProgress) StartCoroutine(Login(loginId, password));
    }

    public void CheckSession()
    {
        if (!accountRequestInProgress) StartCoroutine(GetSession());
    }

    public void SignOut()
    {
        if (!accountRequestInProgress && IsAuthenticated) StartCoroutine(Logout());
    }

    public void LoadMyBookings()
    {
        if (!accountRequestInProgress && IsAuthenticated) StartCoroutine(GetMyBookings());
    }

    public void CancelBooking(string bookingId)
    {
        if (!accountRequestInProgress && IsAuthenticated && !string.IsNullOrWhiteSpace(bookingId))
            StartCoroutine(Cancel(bookingId));
    }

    private void AttachSession(UnityWebRequest request)
    {
#if !UNITY_WEBGL || UNITY_EDITOR
        if (!string.IsNullOrEmpty(sessionCookie)) request.SetRequestHeader("Cookie", sessionCookie);
#endif
    }

    private void CaptureSession(UnityWebRequest request)
    {
#if !UNITY_WEBGL || UNITY_EDITOR
        var value = request.GetResponseHeader("Set-Cookie");
        if (!string.IsNullOrWhiteSpace(value))
            sessionCookie = value.Split(';')[0].Trim();
#endif
    }

    private IEnumerator Login(string loginId, string password)
    {
        accountRequestInProgress = true;
        var payload = JsonUtility.ToJson(new SeatSpaceLoginRequest { loginId = loginId.Trim(), password = password });
        using (var request = new UnityWebRequest(ApiRoot + "/auth/login", UnityWebRequest.kHttpVerbPOST))
        {
            request.uploadHandler = new UploadHandlerRaw(System.Text.Encoding.UTF8.GetBytes(payload));
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");
            request.timeout = 20;
            yield return request.SendWebRequest();
            if (request.result == UnityWebRequest.Result.Success)
            {
                try
                {
                    CaptureSession(request);
                    var response = JsonUtility.FromJson<SeatSpaceLoginResponse>(request.downloadHandler.text);
                    if (response?.user == null || string.IsNullOrWhiteSpace(response.user.id))
                        throw new InvalidOperationException("The server returned no signed-in user.");
                    CurrentUser = response.user;
                    MessageChanged?.Invoke("Signed in as " + CurrentUser.displayName + ".");
                }
                catch (Exception error) { MessageChanged?.Invoke("Could not read the sign-in response: " + error.Message); }
            }
            else MessageChanged?.Invoke(ErrorMessage(request));
        }
        accountRequestInProgress = false;
        if (IsAuthenticated) { LoadMyBookings(); RefreshAvailability(); }
    }

    private IEnumerator GetSession()
    {
        accountRequestInProgress = true;
        using (var request = UnityWebRequest.Get(ApiRoot + "/auth/me"))
        {
            AttachSession(request);
            request.timeout = 12;
            yield return request.SendWebRequest();
            if (request.result == UnityWebRequest.Result.Success)
            {
                try
                {
                    CurrentUser = JsonUtility.FromJson<SeatSpaceProfileResponse>(request.downloadHandler.text)?.user;
                    if (CurrentUser != null) MessageChanged?.Invoke("Signed in as " + CurrentUser.displayName + ".");
                }
                catch (Exception error) { MessageChanged?.Invoke("Could not read the signed-in profile: " + error.Message); }
            }
        }
        accountRequestInProgress = false;
        if (IsAuthenticated) LoadMyBookings();
    }

    private IEnumerator Logout()
    {
        accountRequestInProgress = true;
        using (var request = new UnityWebRequest(ApiRoot + "/auth/logout", UnityWebRequest.kHttpVerbPOST))
        {
            request.downloadHandler = new DownloadHandlerBuffer();
            AttachSession(request);
            request.timeout = 15;
            yield return request.SendWebRequest();
            if (request.result == UnityWebRequest.Result.Success || request.responseCode == 204)
            {
                CurrentUser = null;
                MyBookings = new SeatSpaceBooking[0];
                sessionCookie = "";
                BookingsLoaded?.Invoke(MyBookings);
                MessageChanged?.Invoke("Signed out.");
            }
            else MessageChanged?.Invoke(ErrorMessage(request));
        }
        accountRequestInProgress = false;
    }

    private IEnumerator GetMyBookings()
    {
        accountRequestInProgress = true;
        using (var request = UnityWebRequest.Get(ApiRoot + "/bookings/mine"))
        {
            AttachSession(request);
            request.timeout = 15;
            yield return request.SendWebRequest();
            if (request.result == UnityWebRequest.Result.Success)
            {
                try
                {
                    var response = JsonUtility.FromJson<SeatSpaceBookingsResponse>(request.downloadHandler.text);
                    MyBookings = response?.bookings ?? new SeatSpaceBooking[0];
                    BookingsLoaded?.Invoke(MyBookings);
                }
                catch (Exception error) { MessageChanged?.Invoke("Could not read your bookings: " + error.Message); }
            }
            else MessageChanged?.Invoke(ErrorMessage(request));
        }
        accountRequestInProgress = false;
    }

    private IEnumerator Cancel(string bookingId)
    {
        accountRequestInProgress = true;
        using (var request = new UnityWebRequest(ApiRoot + "/bookings/" + Uri.EscapeDataString(bookingId) + "/cancel", "PATCH"))
        {
            request.downloadHandler = new DownloadHandlerBuffer();
            AttachSession(request);
            request.timeout = 20;
            yield return request.SendWebRequest();
            if (request.result == UnityWebRequest.Result.Success)
                MessageChanged?.Invoke("Booking cancelled. Seat availability has been refreshed.");
            else MessageChanged?.Invoke(ErrorMessage(request));
        }
        accountRequestInProgress = false;
        if (IsAuthenticated) { LoadMyBookings(); RefreshAvailability(); }
    }

    private IEnumerator GetLayout()
    {
        loadingLayout = true;
        string apiProblem = "";
        using (var request = UnityWebRequest.Get(ApiRoot + "/floors/3/layout"))
        {
            request.timeout = 15;
            yield return request.SendWebRequest();
            if (request.result == UnityWebRequest.Result.Success)
            {
                try
                {
                    var databaseLayout = JsonUtility.FromJson<LibraryLayoutDocument>(request.downloadHandler.text);
                    ValidateLayout(databaseLayout);
                    loadingLayout = false;
                    LayoutLoaded?.Invoke(databaseLayout);
                    MessageChanged?.Invoke("Third-floor layout loaded from PostgreSQL through the SeatSpace API.");
                    yield break;
                }
                catch (Exception error)
                {
                    apiProblem = "The layout API returned invalid data: " + error.Message;
                }
            }
            else
            {
                apiProblem = ErrorMessage(request);
            }
        }

        using (var localRequest = UnityWebRequest.Get(Application.streamingAssetsPath + "/seatspace-floor3.json"))
        {
            localRequest.timeout = 15;
            yield return localRequest.SendWebRequest();
            if (localRequest.result == UnityWebRequest.Result.Success)
            {
                try
                {
                    var savedLayout = JsonUtility.FromJson<LibraryLayoutDocument>(localRequest.downloadHandler.text);
                    ValidateLayout(savedLayout);
                    loadingLayout = false;
                    LayoutLoaded?.Invoke(savedLayout);
                    MessageChanged?.Invoke(apiProblem + " Displaying the saved third-floor layout; live seat actions require the API.");
                }
                catch (Exception error)
                {
                    MessageChanged?.Invoke(apiProblem + " Could not read the saved third-floor layout: " + error.Message);
                }
            }
            else
            {
                MessageChanged?.Invoke(apiProblem + " " + ErrorMessage(localRequest) + " No floor layout could be loaded.");
            }
        }
        loadingLayout = false;
    }

    private static void ValidateLayout(LibraryLayoutDocument document)
    {
        if (document == null || document.floorNumber != 3 || document.layout == null || document.tables == null || document.tables.Length == 0)
            throw new InvalidOperationException("The response does not contain the third-floor layout.");

        var ids = new HashSet<string>();
        foreach (var table in document.tables)
        {
            if (table == null || string.IsNullOrWhiteSpace(table.id) || table.position == null || table.position.Length < 2 || table.dimensions == null || table.dimensions.Length < 2 || table.seats == null || table.seatCount != table.seats.Length)
                throw new InvalidOperationException("A table is missing its ID, coordinates, dimensions or seat records.");
            foreach (var seat in table.seats)
                if (seat == null || string.IsNullOrWhiteSpace(seat.id) || !ids.Add(seat.id))
                    throw new InvalidOperationException("The layout contains a missing or duplicate seat ID.");
        }
    }

    private IEnumerator GetAvailability(DateTimeOffset start, DateTimeOffset end)
    {
        loadingAvailability = true;
        var startText = Uri.EscapeDataString(start.ToString("o", CultureInfo.InvariantCulture));
        var endText = Uri.EscapeDataString(end.ToString("o", CultureInfo.InvariantCulture));
        var url = ApiRoot + "/floors/3/availability?startAt=" + startText + "&endAt=" + endText;
        using (var request = UnityWebRequest.Get(url))
        {
            request.timeout = 15;
            yield return request.SendWebRequest();
            if (request.result == UnityWebRequest.Result.Success)
            {
                try
                {
                    var response = JsonUtility.FromJson<SeatAvailabilityResponse>(request.downloadHandler.text);
                    if (response == null || response.floorNumber != 3 || response.seats == null)
                        throw new InvalidOperationException("The API returned invalid seat availability.");
                    loadingAvailability = false;
                    AvailabilityLoaded?.Invoke(response.seats);
                    MessageChanged?.Invoke("Seat availability is current for the selected date and time.");
                }
                catch (Exception error)
                {
                    MessageChanged?.Invoke("Could not read seat availability: " + error.Message);
                }
            }
            else
            {
                MessageChanged?.Invoke(ErrorMessage(request));
            }
        }
        loadingAvailability = false;
    }

    private IEnumerator CreateBooking(string seatId, DateTimeOffset start, DateTimeOffset end)
    {
        bookingInProgress = true;
        var payload = "{\"seatId\":\"" + seatId + "\",\"startAt\":\"" + start.ToString("o", CultureInfo.InvariantCulture) + "\",\"endAt\":\"" + end.ToString("o", CultureInfo.InvariantCulture) + "\"}";
        using (var request = new UnityWebRequest(ApiRoot + "/bookings", UnityWebRequest.kHttpVerbPOST))
        {
            request.uploadHandler = new UploadHandlerRaw(System.Text.Encoding.UTF8.GetBytes(payload));
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");
            AttachSession(request);
            request.timeout = 20;
            yield return request.SendWebRequest();
            if (request.result == UnityWebRequest.Result.Success)
            {
                try
                {
                    var response = JsonUtility.FromJson<SeatSpaceBookingResponse>(request.downloadHandler.text);
                    var bookingId = response?.booking?.id;
                    if (string.IsNullOrWhiteSpace(bookingId)) throw new InvalidOperationException("The server returned no booking ID.");
                    var confirmation = "Booked " + seatId + " | " + start.LocalDateTime.ToString("ddd, h:mm tt") + " – " + end.LocalDateTime.ToString("h:mm tt") + " | booking " + bookingId;
                    MessageChanged?.Invoke(confirmation);
                    bookingInProgress = false;
                    BookingCompleted?.Invoke(confirmation);
                    LoadMyBookings();
                    RefreshAvailability();
                }
                catch (Exception error)
                {
                    MessageChanged?.Invoke("The booking response could not be read: " + error.Message);
                }
            }
            else
            {
                MessageChanged?.Invoke(ErrorMessage(request));
            }
        }
        bookingInProgress = false;
    }

    private static string ErrorMessage(UnityWebRequest request)
    {
        var text = request.downloadHandler == null ? "" : request.downloadHandler.text;
        try
        {
            var error = JsonUtility.FromJson<ApiErrorResponse>(text)?.error;
            if (!string.IsNullOrWhiteSpace(error)) return error;
        }
        catch { }

        if (request.responseCode == 401) return "Please sign in with your SeatSpace account, then try again.";
        if (request.responseCode == 409) return "That seat is no longer available. Refresh seats and choose another one.";
        return "SeatSpace API request failed (" + request.responseCode + "). Check that the website and API are running.";
    }
}
