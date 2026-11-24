using System.IO;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;

public static class SeatSpaceBuildTools
{
    private static string RepositoryRoot => Path.GetFullPath(Path.Combine(Application.dataPath, "..", ".."));
    private const string RuntimeMaterialAssetPath = "Assets/Resources/SeatSpaceRuntimeMaterial.mat";

    [MenuItem("SeatSpace/Build WebGL for React")]
    public static void BuildWebGLForReact()
    {
        Build(BuildTarget.WebGL, Path.Combine(RepositoryRoot, "public", "unity"));
    }

    [MenuItem("SeatSpace/Build Windows desktop demo")]
    public static void BuildWindowsDemo()
    {
        Build(BuildTarget.StandaloneWindows64, Path.Combine(RepositoryRoot, "UnityVirtualLibrary", "Builds", "Windows"));
    }

    private static void Build(BuildTarget target, string outputDirectory)
    {
        EnsureRuntimeMaterial();
        var scenes = new System.Collections.Generic.List<string>();
        foreach (var scene in EditorBuildSettings.scenes)
            if (scene.enabled) scenes.Add(scene.path);
        if (scenes.Count == 0)
        {
            EditorUtility.DisplayDialog("SeatSpace build", "Enable at least one scene in Build Settings first.", "OK");
            return;
        }

        Directory.CreateDirectory(outputDirectory);
        PlayerSettings.productName = "SeatSpaceVirtualLibrary";
        var location = target == BuildTarget.WebGL
            ? outputDirectory
            : Path.Combine(outputDirectory, "SeatSpaceVirtualLibrary.exe");
        var options = new BuildPlayerOptions
        {
            scenes = scenes.ToArray(),
            locationPathName = location,
            target = target,
            options = BuildOptions.None,
        };
        var report = BuildPipeline.BuildPlayer(options);
        var success = report.summary.result == BuildResult.Succeeded;
        var message = success
            ? "Build complete:\n" + location
            : "Build did not complete. Check the Unity Console for the first error.";
        Debug.Log("SeatSpace: " + message);
        if (Application.isBatchMode)
        {
            if (!success) throw new System.InvalidOperationException(message);
            return;
        }
        EditorUtility.DisplayDialog("SeatSpace build", message, "OK");
    }

    private static void EnsureRuntimeMaterial()
    {
        if (!AssetDatabase.IsValidFolder("Assets/Resources"))
            AssetDatabase.CreateFolder("Assets", "Resources");

        // Procedural objects only need stable solid colours. URP/Lit triggers a
        // sampler-format failure on some WebGL implementations (including
        // Chromium's software WebGL path), while URP/Unlit is portable and keeps
        // the reference layout clearly visible.
        var shader = Shader.Find("Universal Render Pipeline/Unlit");
        if (shader == null)
            throw new System.InvalidOperationException("The Universal Render Pipeline/Unlit shader is unavailable.");

        var material = AssetDatabase.LoadAssetAtPath<Material>(RuntimeMaterialAssetPath);
        if (material == null)
        {
            material = new Material(shader) { name = "SeatSpaceRuntimeMaterial", enableInstancing = true };
            AssetDatabase.CreateAsset(material, RuntimeMaterialAssetPath);
        }
        else if (material.shader != shader)
        {
            material.shader = shader;
            material.enableInstancing = true;
            EditorUtility.SetDirty(material);
        }
        AssetDatabase.SaveAssets();
    }
}
