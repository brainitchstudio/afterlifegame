using System.Collections;
using System.IO;
using System.Linq;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;

namespace Afterlife.Tests
{
    public sealed class WatchtowerPlacementTests
    {
        [UnityTest]
        public IEnumerator RestoredWatchtowerVisualDiagnostic()
        {
            var simulation = new Simulation();
            Assert.IsTrue(simulation.GenerateWorld("small", 42067));
            Assert.IsTrue(simulation.Command("devGrantResource", "wood", 1000));
            Assert.IsTrue(simulation.Command("devGrantResource", "metal", 1000));
            var spot = simulation.Preview("tower", 140, -260, 0);
            Assert.IsTrue(spot.ok, spot.reason);
            Assert.IsTrue(simulation.Command("build", "tower", (double)spot.x, (double)spot.y, spot.rotation));
            var frame = simulation.ReadFrame();
            var tower = frame.entities.Where(e => e.kind == "building" && e.type == "tower").OrderByDescending(e => e.id).First();
            var cameraObject = new GameObject("Watchtower diagnostic camera", typeof(Camera));
            var camera = cameraObject.GetComponent<Camera>();
            camera.orthographic = true;
            camera.transform.position = new Vector3(tower.x, -tower.y, -10);
            var worldObject = new GameObject("Watchtower diagnostic world");
            var world = worldObject.AddComponent<WorldView>();
            world.Initialize(camera);
            world.Fit(frame, false);
            world.RebuildTerrain(simulation.ReadTerrain());
            world.Present(frame);
            yield return new WaitForEndOfFrame();
            var renderer = worldObject.GetComponentsInChildren<EntityAuthoring>()
                .Where(e => e.Id == tower.id).Select(e => e.GetComponent<SpriteRenderer>()).Single();
            Debug.Log($"TOWER_DIAGNOSTIC pos={renderer.transform.position} visible={renderer.isVisible} sprite={tower.sprite} color={renderer.color} order={renderer.sortingOrder} camera={camera.transform.position} size={camera.orthographicSize}");
            ScreenCapture.CaptureScreenshot("/tmp/afterlife-tower-diagnostic.png");
            yield return new WaitForEndOfFrame();
            simulation.Dispose();
            Object.Destroy(worldObject);
            Object.Destroy(cameraObject);
        }
        [UnityTest]
        public IEnumerator PlacedWatchtowerRemainsVisibleAfterSimulationStep()
        {
            var cameraObject = new GameObject("Watchtower test camera", typeof(Camera));
            var camera = cameraObject.GetComponent<Camera>();
            camera.orthographic = true;
            camera.transform.position = new Vector3(-352, 256, -10);
            var worldObject = new GameObject("Watchtower test world");
            var world = worldObject.AddComponent<WorldView>();
            world.Initialize(camera);
            var simulation = new Simulation();

            try
            {
                Assert.IsTrue(simulation.Command("devGrantResource", "wood", 1000));
                Assert.IsTrue(simulation.Command("devGrantResource", "metal", 1000));
                var placement = simulation.Preview("tower", -352, -256, 0);
                Assert.IsTrue(placement.ok, placement.reason);
                Assert.IsTrue(simulation.Command("build", "tower", (double)placement.x, (double)placement.y, placement.rotation));

                var frame = simulation.ReadFrame();
                var tower = frame.entities.Single(e => e.kind == "building" && e.type == "tower");
                world.Present(frame);
                simulation.Step(.05f);
                frame = simulation.ReadFrame();
                Assert.IsTrue(frame.entities.Any(e => e.id == tower.id), "Tower was removed from the simulation frame.");
                world.Present(frame);
                yield return new WaitForEndOfFrame();

                var renderer = worldObject.GetComponentsInChildren<EntityAuthoring>()
                    .Where(e => e.Id == tower.id)
                    .Select(e => e.GetComponent<SpriteRenderer>())
                    .Single();
                Assert.IsTrue(renderer.enabled && renderer.sprite != null, "Tower has no rendered sprite.");
                Assert.That(renderer.transform.position.x, Is.EqualTo(tower.x).Within(.01f));
                Assert.That(renderer.transform.position.y, Is.EqualTo(-tower.y).Within(.01f));
                Assert.IsTrue(renderer.isVisible, $"Tower sprite is not visible to the camera. Tower at {renderer.transform.position}, bounds {renderer.bounds}, camera at {camera.transform.position}, size {camera.orthographicSize}, culling mask {camera.cullingMask}, sprite {renderer.sprite.name}.");
            }
            finally
            {
                simulation.Dispose();
                Object.Destroy(worldObject);
                Object.Destroy(cameraObject);
            }
        }
    }
}
