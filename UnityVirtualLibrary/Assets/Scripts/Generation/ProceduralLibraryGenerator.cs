using System.Collections.Generic;
using UnityEngine;
using UnityEngine.XR.Interaction.Toolkit.Locomotion.Teleportation;

public sealed class ProceduralLibraryGenerator : MonoBehaviour
{
    private readonly List<SeatInteractable> seats = new List<SeatInteractable>();
    private readonly Dictionary<string, Material> materials = new Dictionary<string, Material>();
    private Material runtimeMaterialTemplate;
    public IReadOnlyList<SeatInteractable> Seats => seats;

    public void Build(LibraryLayoutDocument document)
    {
        foreach (Transform child in transform) Destroy(child.gameObject);
        seats.Clear();
        if (document == null || document.layout == null) return;

        var floors = Child("Floor areas");
        foreach (var zone in document.layout.zones ?? new FloorZone[0]) BuildFloorZone(floors, zone);
        BuildWalls(Child("Walls"), document.layout.walls);
        BuildDoors(Child("Door frames"), document.layout.doors);
        BuildBoundaries(Child("Patio boundaries"), document.layout.patioBoundaries);
        BuildShelves(Child("Bookshelves"), document.layout.shelves);
        BuildTables(Child("Tables and seats"), document.tables);
        BuildPlants(Child("Greenery"), document.layout.plants);
        BuildFurniture(Child("Furniture"), document.layout.furniture);
        BuildRoomSigns(Child("Room signs"), document.layout.roomLabels);
        BuildEntrance(Child("Entrance"), document.layout.entrance);
        BuildLighting(Child("Lighting"));
    }

    private Transform Child(string name)
    {
        var go = new GameObject(name);
        go.transform.SetParent(transform, false);
        return go.transform;
    }

    private static Color ParseColor(string html, Color fallback)
    {
        return ColorUtility.TryParseHtmlString(html, out var color) ? color : fallback;
    }

    private Material MaterialFor(string key, Color color, float metallic = 0f, float smoothness = 0.35f)
    {
        if (materials.TryGetValue(key, out var existing)) return existing;
        if (runtimeMaterialTemplate == null)
        {
            runtimeMaterialTemplate = Resources.Load<Material>("SeatSpaceRuntimeMaterial");
            if (runtimeMaterialTemplate == null)
            {
                var shader = Shader.Find("Universal Render Pipeline/Unlit") ?? Shader.Find("Unlit/Color");
                if (shader == null)
                    throw new MissingReferenceException("SeatSpaceRuntimeMaterial is missing and no compatible runtime shader is available.");
                runtimeMaterialTemplate = new Material(shader);
            }
        }
        var material = new Material(runtimeMaterialTemplate) { name = "SeatSpace " + key, color = color };
        if (material.HasProperty("_Metallic")) material.SetFloat("_Metallic", metallic);
        if (material.HasProperty("_Smoothness")) material.SetFloat("_Smoothness", smoothness);
        materials.Add(key, material);
        return material;
    }

    private GameObject Cube(Transform parent, string name, Vector3 position, Vector3 scale, string materialKey, Color color, bool collider = true, float metallic = 0f)
    {
        var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
        go.name = name;
        go.transform.SetParent(parent, false);
        go.transform.localPosition = position;
        go.transform.localScale = scale;
        go.GetComponent<Renderer>().sharedMaterial = MaterialFor(materialKey, color, metallic);
        if (!collider) Destroy(go.GetComponent<Collider>());
        return go;
    }

    private GameObject Sphere(Transform parent, string name, Vector3 position, Vector3 scale, string materialKey, Color color)
    {
        var go = GameObject.CreatePrimitive(PrimitiveType.Sphere);
        go.name = name;
        go.transform.SetParent(parent, false);
        go.transform.localPosition = position;
        go.transform.localScale = scale;
        go.GetComponent<Renderer>().sharedMaterial = MaterialFor(materialKey, color);
        Destroy(go.GetComponent<Collider>());
        return go;
    }

    private void BuildFloorZone(Transform parent, FloorZone zone)
    {
        var floorColor = ParseColor(zone.color, new Color(0.96f, 0.93f, 0.84f));
        var floor = Cube(parent, zone.id, new Vector3(zone.x, zone.y - 0.07f, -zone.z), new Vector3(zone.w, 0.14f, zone.d), "floor-" + zone.color, floorColor);
        floor.AddComponent<TeleportationArea>();
        if (zone.id.Contains("patio")) AddPatioGrout(parent, zone);
    }

    private void AddPatioGrout(Transform parent, FloorZone zone)
    {
        var grout = new Color(0.60f, 0.61f, 0.60f);
        var left = zone.x - zone.w / 2f;
        var right = zone.x + zone.w / 2f;
        var floorZ = -zone.z;
        var top = floorZ - zone.d / 2f;
        var bottom = floorZ + zone.d / 2f;
        for (var x = left + 0.5f; x < right; x += 0.5f)
            Cube(parent, "Patio tile seam", new Vector3(x, 0.003f, floorZ), new Vector3(0.012f, 0.006f, zone.d), "patio-grout", grout, false);
        for (var z = top + 0.5f; z < bottom; z += 0.5f)
            Cube(parent, "Patio tile seam", new Vector3(zone.x, 0.003f, z), new Vector3(zone.w, 0.006f, 0.012f), "patio-grout", grout, false);
    }

    private void BuildWalls(Transform parent, WallSegment[] walls)
    {
        var color = new Color32(35, 35, 33, 255);
        foreach (var wall in walls ?? new WallSegment[0])
        {
            var start = new Vector2(wall.x1, -wall.z1);
            var end = new Vector2(wall.x2, -wall.z2);
            var delta = end - start;
            var go = Cube(parent, "Wall", new Vector3((start.x + end.x) / 2f, 1.5f, (start.y + end.y) / 2f), new Vector3(delta.magnitude, 3f, 0.18f), "charcoal-wall", color);
            go.transform.localRotation = Quaternion.Euler(0f, -Mathf.Atan2(delta.y, delta.x) * Mathf.Rad2Deg, 0f);
        }
    }

    private void BuildDoors(Transform parent, DoorLayout[] doors)
    {
        var frame = new Color32(77, 43, 28, 255);
        foreach (var door in doors ?? new DoorLayout[0])
        {
            var root = new GameObject("Door frame · " + door.id).transform;
            root.SetParent(parent, false);
            root.localPosition = new Vector3(door.x, 0f, -door.z);
            var facesAlongZ = door.id.StartsWith("patio-door") || door.id == "shelf-room";
            root.localRotation = Quaternion.Euler(0f, facesAlongZ ? -90f : 0f, 0f);
            var postWidth = 0.10f;
            Cube(root, "Left jamb", new Vector3(-door.width / 2f, 1.0f, 0f), new Vector3(postWidth, 2f, 0.16f), "door-frame", frame);
            Cube(root, "Right jamb", new Vector3(door.width / 2f, 1.0f, 0f), new Vector3(postWidth, 2f, 0.16f), "door-frame", frame);
            Cube(root, "Lintel", new Vector3(0f, 2.0f, 0f), new Vector3(door.width + postWidth, 0.12f, 0.16f), "door-frame", frame);
            var hinge = new GameObject("Open door · " + door.id).transform;
            hinge.SetParent(root, false);
            hinge.localPosition = new Vector3(-door.width / 2f + 0.035f, 0f, 0f);
            hinge.localRotation = Quaternion.Euler(0f, -door.rotation * Mathf.Rad2Deg, 0f);
            Cube(hinge, "Wooden door leaf", new Vector3(door.width / 2f, 1.0f, 0f), new Vector3(door.width - 0.05f, 1.92f, 0.07f), "door-leaf", new Color32(119, 78, 47, 255), false);
        }
    }

    private void BuildBoundaries(Transform parent, WallSegment[] boundaries)
    {
        var metal = new Color32(42, 48, 43, 255);
        foreach (var line in boundaries ?? new WallSegment[0])
        {
            var start = new Vector2(line.x1, -line.z1);
            var end = new Vector2(line.x2, -line.z2);
            var delta = end - start;
            var length = delta.magnitude;
            var center = new Vector3((start.x + end.x) / 2f, 0.32f, (start.y + end.y) / 2f);
            var root = new GameObject("Low patio rail").transform;
            root.SetParent(parent, false);
            root.localPosition = center;
            root.localRotation = Quaternion.Euler(0f, -Mathf.Atan2(delta.y, delta.x) * Mathf.Rad2Deg, 0f);
            Cube(root, "Top rail", Vector3.zero, new Vector3(length, 0.06f, 0.05f), "patio-rail", metal, false, 0.55f);
            Cube(root, "Lower rail", new Vector3(0f, -0.21f, 0f), new Vector3(length, 0.04f, 0.05f), "patio-rail", metal, false, 0.55f);
            var postCount = Mathf.Max(2, Mathf.CeilToInt(length / 0.7f));
            for (var i = 0; i <= postCount; i++)
            {
                var x = -length / 2f + length * i / postCount;
                Cube(root, "Fence post", new Vector3(x, -0.16f, 0f), new Vector3(0.045f, 0.32f, 0.045f), "patio-rail", metal, false, 0.55f);
            }
        }
    }

    private void BuildTables(Transform parent, LibraryTable[] tables)
    {
        var wood = new Color32(224, 143, 51, 255);
        var darkWood = new Color32(104, 58, 29, 255);
        foreach (var table in tables ?? new LibraryTable[0])
        {
            if (table.position == null || table.position.Length < 2 || table.dimensions == null || table.dimensions.Length < 2) continue;
            var root = new GameObject("Table " + table.id).transform;
            root.SetParent(parent, false);
            root.localPosition = new Vector3(table.position[0], 0f, -table.position[1]);
            // The React scene stores half-width and half-depth for Three.js boxGeometry.
            var width = table.dimensions[0] * 2f;
            var depth = table.dimensions[1] * 2f;
            Cube(root, "Wood tabletop", new Vector3(0f, 0.76f, 0f), new Vector3(width, 0.12f, depth), "table-wood", wood, true, 0.03f);
            var legOffsetX = Mathf.Max(0.08f, width / 2f - 0.1f);
            var legOffsetZ = Mathf.Max(0.08f, depth / 2f - 0.1f);
            foreach (var x in new[] { -legOffsetX, legOffsetX })
            foreach (var z in new[] { -legOffsetZ, legOffsetZ })
                Cube(root, "Table leg", new Vector3(x, 0.37f, z), new Vector3(0.085f, 0.74f, 0.085f), "table-legs", darkWood, true);
            AddTableLabel(root, table.label);
            foreach (var seat in table.seats ?? new LibrarySeat[0]) BuildChair(parent, table.id, seat);
        }
    }

    private void AddTableLabel(Transform parent, string label)
    {
        var sign = new GameObject("Table label");
        sign.transform.SetParent(parent, false);
        sign.transform.localPosition = new Vector3(0f, 0.827f, 0f);
        sign.transform.localRotation = Quaternion.Euler(-90f, 0f, 0f);
        var text = sign.AddComponent<TextMesh>();
        text.text = label ?? "";
        text.anchor = TextAnchor.MiddleCenter;
        text.alignment = TextAlignment.Center;
        text.fontSize = 48;
        text.characterSize = 0.12f;
        text.color = new Color32(45, 31, 22, 255);
    }

    private void BuildChair(Transform parent, string tableId, LibrarySeat seat)
    {
        if (seat.position == null) return;
        var root = new GameObject("Seat " + seat.id);
        root.transform.SetParent(parent, false);
        root.transform.localPosition = new Vector3(seat.position.x, 0f, -seat.position.z);
        root.transform.localRotation = Quaternion.Euler(0f, -seat.position.rotation * Mathf.Rad2Deg, 0f);
        var hit = root.AddComponent<BoxCollider>();
        hit.center = new Vector3(0f, 0.42f, 0f);
        hit.size = new Vector3(0.48f, 0.88f, 0.5f);

        var fabric = new Color32(47, 140, 87, 255);
        var chair = new Color32(103, 72, 48, 255);
        var seatVisual = Cube(root.transform, "Seat pad", new Vector3(0f, 0.44f, 0f), new Vector3(0.36f, 0.09f, 0.36f), "seat-fabric", fabric, false);
        Cube(root.transform, "Back pad", new Vector3(0f, 0.68f, -0.17f), new Vector3(0.34f, 0.34f, 0.07f), "seat-fabric", fabric, false);
        Cube(root.transform, "Back support", new Vector3(0f, 0.55f, -0.17f), new Vector3(0.035f, 0.22f, 0.035f), "chair-frame", chair, false);
        foreach (var x in new[] { -0.14f, 0.14f })
        foreach (var z in new[] { -0.14f, 0.14f })
            Cube(root.transform, "Chair leg", new Vector3(x, 0.21f, z), new Vector3(0.035f, 0.42f, 0.035f), "chair-frame", chair, false);

        var ring = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
        ring.name = "Selection glow";
        ring.transform.SetParent(root.transform, false);
        ring.transform.localPosition = new Vector3(0f, 0.025f, 0f);
        ring.transform.localScale = new Vector3(0.62f, 0.012f, 0.62f);
        ring.GetComponent<Renderer>().sharedMaterial = MaterialFor("selection-glow", new Color32(36, 174, 234, 255), 0f, 0.8f);
        Destroy(ring.GetComponent<Collider>());
        ring.SetActive(false);

        var interactable = root.AddComponent<SeatInteractable>();
        interactable.Initialize(seat.id, tableId, new[] { seatVisual.GetComponent<Renderer>(), root.transform.Find("Back pad").GetComponent<Renderer>() }, ring.GetComponent<Renderer>());
        seats.Add(interactable);
    }

    private void BuildShelves(Transform parent, ShelfLayout[] shelves)
    {
        var wood = new Color32(103, 54, 28, 255);
        var bookColors = new[] { new Color32(143, 54, 37, 255), new Color32(45, 82, 110, 255), new Color32(48, 99, 70, 255), new Color32(198, 139, 56, 255), new Color32(82, 59, 102, 255) };
        var index = 0;
        foreach (var shelf in shelves ?? new ShelfLayout[0])
        {
            var root = new GameObject("Bookshelf row " + (++index)).transform;
            root.SetParent(parent, false);
            root.localPosition = new Vector3(shelf.x, 0f, -shelf.z);
            var alongX = shelf.w >= shelf.d;
            var length = Mathf.Max(shelf.w, shelf.d);
            var depth = Mathf.Min(shelf.w, shelf.d);
            var yaw = alongX ? 0f : -90f;
            root.localRotation = Quaternion.Euler(0f, yaw, 0f);
            Cube(root, "Bookcase backing", new Vector3(0f, 0.96f, 0f), new Vector3(length, 1.92f, 0.08f), "bookcase-wood", wood);
            for (var level = 0; level < 4; level++)
            {
                var y = 0.18f + level * 0.52f;
                Cube(root, "Shelf board", new Vector3(0f, y, depth / 2f), new Vector3(length, 0.065f, Mathf.Max(0.3f, depth)), "bookcase-wood", wood);
                var bookCount = Mathf.Max(4, Mathf.FloorToInt(length / 0.19f));
                for (var book = 0; book < bookCount; book++)
                {
                    var bookWidth = 0.13f + (book % 3) * 0.015f;
                    var x = -length / 2f + 0.1f + book * (length - 0.2f) / Mathf.Max(1, bookCount - 1);
                    var h = 0.29f + (book % 4) * 0.045f;
                    Cube(root, "Book", new Vector3(x, y + 0.07f + h / 2f, 0.10f), new Vector3(bookWidth, h, 0.22f), "book-cover-" + (book % bookColors.Length), bookColors[book % bookColors.Length], false);
                }
            }
        }
    }

    private void BuildPlants(Transform parent, PlantLayout[] plants)
    {
        var trunk = new Color32(104, 69, 39, 255);
        var leaf = new Color32(62, 126, 46, 255);
        var leafLight = new Color32(104, 161, 52, 255);
        var index = 0;
        foreach (var plant in plants ?? new PlantLayout[0])
        {
            var scale = Mathf.Max(0.55f, plant.scale);
            var root = new GameObject("Planter " + (++index)).transform;
            root.SetParent(parent, false);
            root.localPosition = new Vector3(plant.x, 0f, -plant.z);
            Cube(root, "Dark planter", new Vector3(0f, 0.14f, 0f), new Vector3(0.58f * scale, 0.28f, 0.58f * scale), "planter-dark", new Color32(44, 51, 41, 255));
            var stem = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            stem.name = "Tree trunk";
            stem.transform.SetParent(root, false);
            stem.transform.localPosition = new Vector3(0f, 0.62f * scale, 0f);
            stem.transform.localScale = new Vector3(0.11f * scale, 0.48f * scale, 0.11f * scale);
            stem.GetComponent<Renderer>().sharedMaterial = MaterialFor("plant-trunk", trunk);
            Destroy(stem.GetComponent<Collider>());
            for (var leafIndex = 0; leafIndex < 7; leafIndex++)
            {
                var angle = leafIndex * Mathf.PI * 2f / 7f;
                var radius = leafIndex == 0 ? 0f : 0.35f * scale;
                var y = leafIndex == 0 ? 1.15f * scale : (leafIndex % 2 == 0 ? 0.95f : 1.24f) * scale;
                var leafColor = leafIndex % 2 == 0 ? leaf : leafLight;
                Sphere(root, "Leaf cluster", new Vector3(Mathf.Cos(angle) * radius, y, Mathf.Sin(angle) * radius), new Vector3(0.48f, 0.25f, 0.40f) * scale, "plant-leaf-" + leafIndex % 2, leafColor);
            }
        }
    }

    private void BuildFurniture(Transform parent, FurnitureLayout furniture)
    {
        if (furniture == null) return;
        if (furniture.reception != null) BuildReception(parent, furniture.reception);
        if (furniture.sofa != null) BuildSofa(parent, furniture.sofa);
    }

    private void BuildReception(Transform parent, FurnitureItem item)
    {
        var root = new GameObject("Reception desk").transform;
        root.SetParent(parent, false);
        root.localPosition = new Vector3(item.pos[0], 0f, -item.pos[1]);
        var w = item.size[0]; var d = item.size[1];
        var wood = new Color32(167, 99, 45, 255);
        Cube(root, "Desk cabinet", new Vector3(0f, 0.48f, 0f), new Vector3(w, 0.9f, d), "reception-wood", wood);
        Cube(root, "Desk counter", new Vector3(0f, 0.96f, 0f), new Vector3(w + 0.08f, 0.12f, d + 0.08f), "reception-counter", new Color32(202, 134, 68, 255));
        var label = AddWorldLabel(root, "Reception", new Vector3(0f, 0.56f, -d / 2f - 0.025f), 0.09f);
        // TextMesh faces +Z by default; the counter label sits on its -Z face.
        label.localRotation = Quaternion.Euler(0f, 180f, 0f);
        label.localScale = new Vector3(-1f, 1f, 1f);
        var topLabel = new GameObject("Reception overhead label").transform;
        topLabel.SetParent(root, false);
        topLabel.localPosition = new Vector3(0f, 1.035f, 0f);
        topLabel.localRotation = Quaternion.Euler(-90f, 0f, 0f);
        AddWorldLabel(topLabel, "Reception", Vector3.zero, 0.11f);
    }

    private void BuildSofa(Transform parent, FurnitureItem item)
    {
        var root = new GameObject("Purple lounge sofa").transform;
        root.SetParent(parent, false);
        root.localPosition = new Vector3(item.pos[0], 0f, -item.pos[1]);
        var w = item.size[0]; var d = item.size[1];
        var purple = new Color32(156, 95, 166, 255);
        var dark = new Color32(109, 66, 119, 255);
        var railDepth = Mathf.Min(0.62f, d * 0.28f);
        var railWidth = Mathf.Min(0.62f, w * 0.44f);
        // The reference shows an open C-shaped lounge facing left, with a separate round ottoman.
        Cube(root, "Sofa right base", new Vector3(w / 2f - railWidth / 2f, 0.25f, 0f), new Vector3(railWidth, 0.35f, d), "sofa-dark", dark);
        Cube(root, "Sofa upper base", new Vector3(0f, 0.25f, -d / 2f + railDepth / 2f), new Vector3(w, 0.35f, railDepth), "sofa-dark", dark);
        Cube(root, "Sofa lower base", new Vector3(0f, 0.25f, d / 2f - railDepth / 2f), new Vector3(w, 0.35f, railDepth), "sofa-dark", dark);
        Cube(root, "Sofa right back", new Vector3(w / 2f - railWidth, 0.70f, 0f), new Vector3(0.20f, 0.75f, d), "sofa-purple", purple);
        Cube(root, "Sofa upper back", new Vector3(0f, 0.70f, -d / 2f + 0.12f), new Vector3(w, 0.75f, 0.20f), "sofa-purple", purple);
        Cube(root, "Sofa lower back", new Vector3(0f, 0.70f, d / 2f - 0.12f), new Vector3(w, 0.75f, 0.20f), "sofa-purple", purple);
        Cube(root, "Sofa right cushion", new Vector3(w / 2f - railWidth / 2f, 0.48f, 0f), new Vector3(railWidth - 0.20f, 0.17f, d - 0.45f), "sofa-purple", new Color32(180, 123, 190, 255), false);
        Cube(root, "Sofa upper cushion", new Vector3(-w * 0.20f, 0.48f, -d / 2f + railDepth / 2f), new Vector3(w * 0.52f, 0.17f, railDepth - 0.16f), "sofa-purple", new Color32(180, 123, 190, 255), false);
        Cube(root, "Sofa lower cushion", new Vector3(-w * 0.20f, 0.48f, d / 2f - railDepth / 2f), new Vector3(w * 0.52f, 0.17f, railDepth - 0.16f), "sofa-purple", new Color32(180, 123, 190, 255), false);
        var ottoman = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
        ottoman.name = "Round purple ottoman";
        ottoman.transform.SetParent(root, false);
        ottoman.transform.localPosition = new Vector3(-w / 2f - 0.32f, 0.23f, 0f);
        ottoman.transform.localScale = new Vector3(0.76f, 0.23f, 0.76f);
        ottoman.GetComponent<Renderer>().sharedMaterial = MaterialFor("sofa-ottoman", new Color32(180, 123, 190, 255));
        Destroy(ottoman.GetComponent<Collider>());
    }

    private void BuildRoomSigns(Transform parent, RoomLabel[] labels)
    {
        foreach (var item in labels ?? new RoomLabel[0])
        {
            var overheadLabel = new GameObject("Overhead room label · " + item.label).transform;
            overheadLabel.SetParent(parent, false);
            overheadLabel.localPosition = new Vector3(item.x, 3.08f, -item.z);
            overheadLabel.localRotation = Quaternion.Euler(-90f, 0f, 0f);
            AddWorldLabel(overheadLabel, item.label, Vector3.zero, 0.04f);
        }
    }

    private void BuildEntrance(Transform parent, EntranceLayout entrance)
    {
        if (entrance == null || entrance.pos == null || entrance.pos.Length < 2) return;
        var overheadLabel = new GameObject("Overhead entrance label").transform;
        overheadLabel.SetParent(parent, false);
        overheadLabel.localPosition = new Vector3(entrance.pos[0], 3.08f, -entrance.pos[1]);
        overheadLabel.localRotation = Quaternion.Euler(-90f, 0f, 0f);
        AddWorldLabel(overheadLabel, entrance.label, Vector3.zero, 0.09f);
    }

    private static Transform AddWorldLabel(Transform parent, string label, Vector3 localPosition, float size)
    {
        var textObject = new GameObject("Readable label");
        textObject.transform.SetParent(parent, false);
        textObject.transform.localPosition = localPosition;
        var text = textObject.AddComponent<TextMesh>();
        text.text = label;
        text.anchor = TextAnchor.MiddleCenter;
        text.alignment = TextAlignment.Center;
        text.fontSize = 48;
        text.characterSize = size;
        text.color = new Color32(43, 47, 59, 255);
        return textObject.transform;
    }

    private void BuildLighting(Transform parent)
    {
        var ambient = new GameObject("Soft ambient fill").AddComponent<Light>();
        ambient.name = "Soft ambient fill";
        ambient.transform.SetParent(parent, false);
        ambient.type = LightType.Point;
        ambient.color = new Color(1f, 0.93f, 0.79f);
        ambient.intensity = 2.2f;
        ambient.range = 38f;
        ambient.shadows = LightShadows.None;
        ambient.transform.localPosition = new Vector3(4f, 9f, 0f);

        var key = new GameObject("Warm key light").AddComponent<Light>();
        key.type = LightType.Directional;
        key.color = new Color(1f, 0.9f, 0.76f);
        key.intensity = 1.0f;
        key.shadows = LightShadows.Soft;
        key.transform.SetParent(parent, false);
        key.transform.localRotation = Quaternion.Euler(50f, -35f, 0f);
    }
}
