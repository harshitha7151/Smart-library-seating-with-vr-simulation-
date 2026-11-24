using System;

[Serializable]
public sealed class LibraryLayoutDocument
{
    public int floorNumber;
    public string label;
    public float unitsPerPixel;
    public string coordinateNotes;
    public LibraryGeometry layout;
    public LibraryTable[] tables;
}

[Serializable]
public sealed class LibraryGeometry
{
    public FloorZone[] zones;
    public WallSegment[] walls;
    public DoorLayout[] doors;
    public WallSegment[] patioBoundaries;
    public RoomLabel[] roomLabels;
    public ShelfLayout[] shelves;
    public PlantLayout[] plants;
    public EntranceLayout entrance;
    public FurnitureLayout furniture;
}

[Serializable]
public sealed class FloorZone
{
    public string id;
    public float x, z, w, d, y;
    public string color;
}

[Serializable]
public sealed class WallSegment
{
    public float x1, z1, x2, z2;
}

[Serializable]
public sealed class DoorLayout
{
    public string id;
    public float x, z, width, rotation;
}

[Serializable]
public sealed class RoomLabel
{
    public string id, label, color;
    public float x, z;
}

[Serializable]
public sealed class ShelfLayout
{
    public float x, z, w, d;
}

[Serializable]
public sealed class PlantLayout
{
    public float x, z, scale;
}

[Serializable]
public sealed class EntranceLayout
{
    public float[] pos;
    public string label;
}

[Serializable]
public sealed class FurnitureLayout
{
    public FurnitureItem reception;
    public FurnitureItem sofa;
}

[Serializable]
public sealed class FurnitureItem
{
    public float[] pos;
    public float[] size;
}

[Serializable]
public sealed class LibraryTable
{
    public string id, label;
    public int seatCount;
    public float[] position;
    public float[] dimensions;
    public bool outdoor;
    public LibrarySeat[] seats;
}

[Serializable]
public sealed class LibrarySeat
{
    public string id;
    public int number;
    public SeatPosition position;
}

[Serializable]
public sealed class SeatPosition
{
    public float x, z, rotation;
}

[Serializable]
public sealed class SeatAvailabilityResponse
{
    public int floorNumber;
    public string startAt, endAt;
    public SeatStatus[] seats;
}

[Serializable]
public sealed class SeatStatus
{
    public string seatId, tableId, status;
    public string currentStartAt, currentEndAt, currentCheckedInAt;
    public string reservationStartAt, reservationEndAt, reservationCheckedInAt;
}

[Serializable]
public sealed class SeatSpaceBookingResponse
{
    public SeatSpaceBooking booking;
}

[Serializable]
public sealed class SeatSpaceBookingsResponse
{
    public SeatSpaceBooking[] bookings;
}

[Serializable]
public sealed class SeatSpaceLoginRequest
{
    public string loginId, password;
}

[Serializable]
public sealed class SeatSpaceLoginResponse
{
    public SeatSpaceUser user;
}

[Serializable]
public sealed class SeatSpaceProfileResponse
{
    public SeatSpaceUser user;
}

[Serializable]
public sealed class SeatSpaceUser
{
    public string id, email, displayName;
}

[Serializable]
public sealed class SeatSpaceBooking
{
    public string id, seatId, startAt, endAt, checkInDeadline, checkedInAt, status;
}

[Serializable]
public sealed class ApiErrorResponse
{
    public string error;
}
