using System;
using UnityEngine;
using UnityEngine.XR.Interaction.Toolkit;
using UnityEngine.XR.Interaction.Toolkit.Interactables;

public sealed class SeatInteractable : MonoBehaviour
{
    public string SeatId { get; private set; }
    public string TableId { get; private set; }
    public string Status { get; private set; } = "unknown";
    public bool IsSelected { get; private set; }
    public string ReservationStartAt { get; private set; }
    public string ReservationEndAt { get; private set; }
    public string CurrentStartAt { get; private set; }
    public string CurrentEndAt { get; private set; }

    private Renderer[] statusRenderers;
    private Renderer selectionRenderer;
    private GameObject seatedAvatar;
    private XRSimpleInteractable xrInteractable;
    private Action<SeatInteractable> xrSelectionCallback;
    private static readonly int BaseColor = Shader.PropertyToID("_BaseColor");
    private static readonly int ColorId = Shader.PropertyToID("_Color");

    public void Initialize(string seatId, string tableId, Renderer[] renderers, Renderer ring)
    {
        SeatId = seatId;
        TableId = tableId;
        statusRenderers = renderers;
        selectionRenderer = ring;
        ApplyVisualState();
    }

    public void SetAvailability(SeatStatus availability)
    {
        Status = string.IsNullOrWhiteSpace(availability?.status) ? "unavailable" : availability.status;
        ReservationStartAt = availability?.reservationStartAt;
        ReservationEndAt = availability?.reservationEndAt;
        CurrentStartAt = availability?.currentStartAt;
        CurrentEndAt = availability?.currentEndAt;
        var checkedInNow = availability != null
            && !string.IsNullOrWhiteSpace(availability.currentCheckedInAt)
            && IsNowWithin(availability.currentStartAt, availability.currentEndAt);
        UpdateSeatedAvatar(checkedInNow);
        ApplyVisualState();
    }

    public void SetSelected(bool selected)
    {
        IsSelected = selected;
        if (selectionRenderer != null) selectionRenderer.gameObject.SetActive(selected);
        ApplyVisualState();
    }

    // Every chair remains inspectable; booking is separately gated by its live status.
    public bool CanSelect => true;

    public void ConfigureXRInteraction(bool enabled, Action<SeatInteractable> onSelected)
    {
        xrSelectionCallback = onSelected;
        if (enabled && xrInteractable == null)
        {
            xrInteractable = gameObject.AddComponent<XRSimpleInteractable>();
            xrInteractable.selectEntered.AddListener(OnXRSelected);
        }
        else if (!enabled && xrInteractable != null)
        {
            xrInteractable.selectEntered.RemoveListener(OnXRSelected);
            Destroy(xrInteractable);
            xrInteractable = null;
        }
    }

    private void OnXRSelected(SelectEnterEventArgs _)
    {
        if (CanSelect) xrSelectionCallback?.Invoke(this);
    }

    private static bool IsNowWithin(string startText, string endText)
    {
        return DateTimeOffset.TryParse(startText, out var start)
            && DateTimeOffset.TryParse(endText, out var end)
            && DateTimeOffset.UtcNow >= start.UtcDateTime
            && DateTimeOffset.UtcNow < end.UtcDateTime;
    }

    private void UpdateSeatedAvatar(bool visible)
    {
        if (visible)
        {
            if (seatedAvatar == null) seatedAvatar = CreateSeatedAvatar();
            return;
        }

        if (seatedAvatar != null)
        {
            Destroy(seatedAvatar);
            seatedAvatar = null;
        }
    }

    private GameObject CreateSeatedAvatar()
    {
        var root = new GameObject("Active student · " + SeatId);
        root.transform.SetParent(transform, false);
        var shirt = new Color32(51, 98, 166, 255);
        var trousers = new Color32(48, 55, 68, 255);
        var skin = new Color32(196, 143, 105, 255);
        var shoes = new Color32(35, 36, 39, 255);

        AvatarPiece(root.transform, PrimitiveType.Capsule, "Torso", new Vector3(0f, 0.91f, -0.015f), new Vector3(0.32f, 0.30f, 0.28f), shirt);
        AvatarPiece(root.transform, PrimitiveType.Sphere, "Head", new Vector3(0f, 1.34f, 0.015f), new Vector3(0.22f, 0.24f, 0.22f), skin);
        AvatarPiece(root.transform, PrimitiveType.Cylinder, "Neck", new Vector3(0f, 1.18f, 0f), new Vector3(0.075f, 0.075f, 0.075f), skin);
        AvatarPiece(root.transform, PrimitiveType.Capsule, "Left thigh", new Vector3(-0.09f, 0.49f, 0.14f), new Vector3(0.13f, 0.20f, 0.13f), trousers, new Vector3(78f, 0f, 0f));
        AvatarPiece(root.transform, PrimitiveType.Capsule, "Right thigh", new Vector3(0.09f, 0.49f, 0.14f), new Vector3(0.13f, 0.20f, 0.13f), trousers, new Vector3(78f, 0f, 0f));
        AvatarPiece(root.transform, PrimitiveType.Capsule, "Left lower leg", new Vector3(-0.09f, 0.27f, 0.34f), new Vector3(0.105f, 0.17f, 0.105f), trousers, new Vector3(18f, 0f, 0f));
        AvatarPiece(root.transform, PrimitiveType.Capsule, "Right lower leg", new Vector3(0.09f, 0.27f, 0.34f), new Vector3(0.105f, 0.17f, 0.105f), trousers, new Vector3(18f, 0f, 0f));
        AvatarPiece(root.transform, PrimitiveType.Cube, "Left shoe", new Vector3(-0.09f, 0.085f, 0.43f), new Vector3(0.13f, 0.10f, 0.25f), shoes);
        AvatarPiece(root.transform, PrimitiveType.Cube, "Right shoe", new Vector3(0.09f, 0.085f, 0.43f), new Vector3(0.13f, 0.10f, 0.25f), shoes);
        AvatarPiece(root.transform, PrimitiveType.Capsule, "Left arm", new Vector3(-0.20f, 0.84f, 0.035f), new Vector3(0.10f, 0.22f, 0.10f), shirt, new Vector3(0f, 0f, -12f));
        AvatarPiece(root.transform, PrimitiveType.Capsule, "Right arm", new Vector3(0.20f, 0.84f, 0.035f), new Vector3(0.10f, 0.22f, 0.10f), shirt, new Vector3(0f, 0f, 12f));
        AvatarPiece(root.transform, PrimitiveType.Sphere, "Left hand", new Vector3(-0.24f, 0.67f, 0.12f), new Vector3(0.09f, 0.08f, 0.09f), skin);
        AvatarPiece(root.transform, PrimitiveType.Sphere, "Right hand", new Vector3(0.24f, 0.67f, 0.12f), new Vector3(0.09f, 0.08f, 0.09f), skin);
        return root;
    }

    private static void AvatarPiece(Transform parent, PrimitiveType type, string label, Vector3 position, Vector3 scale, Color color, Vector3 rotation = default)
    {
        var piece = GameObject.CreatePrimitive(type);
        piece.name = label;
        piece.transform.SetParent(parent, false);
        piece.transform.localPosition = position;
        piece.transform.localScale = scale;
        piece.transform.localRotation = Quaternion.Euler(rotation);
        var collider = piece.GetComponent<Collider>();
        if (collider != null) Destroy(collider);
        var renderer = piece.GetComponent<Renderer>();
        var block = new MaterialPropertyBlock();
        renderer.GetPropertyBlock(block);
        block.SetColor(BaseColor, color);
        block.SetColor(ColorId, color);
        renderer.SetPropertyBlock(block);
    }

    private void ApplyVisualState()
    {
        if (statusRenderers == null) return;
        var color = Status switch
        {
            // Blue matches the approved floor-plan seat symbol; other backend states remain distinct.
            "available" => new Color32(18, 100, 232, 255),
            "booked" => new Color32(224, 181, 47, 255),
            "occupied" => new Color32(199, 67, 67, 255),
            "unavailable" => new Color32(148, 163, 184, 255),
            _ => new Color32(18, 100, 232, 255),
        };
        foreach (var renderer in statusRenderers)
        {
            if (renderer == null) continue;
            var block = new MaterialPropertyBlock();
            renderer.GetPropertyBlock(block);
            block.SetColor(BaseColor, color);
            block.SetColor(ColorId, color);
            renderer.SetPropertyBlock(block);
        }
    }
}
