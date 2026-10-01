WORLD GENERATOR KIT
Update pack: world generator, placement rules and the Unity loader. Sprites are unchanged from the Zombie Base Kit.

What changed
  pixel-worldgen.js   Generator. Complete starting wall ring, roofs never cover walls, towers or other
                      buildings, clear ring around the base, gate approach kept open.
  pixel-rules.js      New. computeRules(map) builds a per-tile bit grid; validate(map) lists rule breaks;
                      canPlace(rules, w, tx, ty, fw, fh, kind) is the JS version of the Unity check.
  unity/SurvivalMapLoader.cs
                      Reads rules[] and baseRect. Adds CanPlace, HasRule, InBase, MarkBlocked.
  unity/README.txt    Rule bits and which placement kinds each bit blocks.

Unity - only the loader changed
  1. Replace SurvivalMapLoader.cs in your project with unity/SurvivalMapLoader.cs.
  2. Re-export the map you use (steps below) so its JSON carries rules[]. Existing atlases still work.
  3. In game code, check before spawning anything at runtime:
       if (loader.CanPlace(tx, ty, fw, fh, SurvivalMapLoader.PlaceKind.Foliage)) {
           Spawn(...); loader.MarkBlocked(tx, ty, fw, fh);
       }
     Kinds: Foliage, Prop, TallProp, BaseProp, Building, Road, ZombieSpawn.

Making a map
  The .dc.html pages load their modules, so serve this folder over http rather than opening from disk
  (e.g. "npx serve" or "python -m http.server" inside the folder).
  1. World Generator.dc.html   pick size and seed, check "Rule checks" all pass, Download for editor.
  2. Map Editor v2.dc.html     open the .survmap.json, then export to Unity. The zip includes rules[].
  "Download rules grid" in the generator saves the grid alone as {name}.rules.json if you only need that.

Keep all .js files in the same folder as the .dc.html pages.
