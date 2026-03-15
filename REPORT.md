# Rapport d'état du projet

## ✅ Ce qui fonctionne actuellement
- Le site est structuré dans `docs/` et peut être servi via un serveur local (`python3 -m http.server 8000`) ou via GitHub Pages.
- L'intro vidéo (`intro.mp4`) se lance et l'utilisateur peut appuyer sur **espace** pour passer à la séquence suivante.
- Les vidéos locales (`why.mp4`, `school.mp4`, `craycray.mp4`) sont présentes dans `docs/media/` et le code tente de les jouer dans l'ordre.
- Le mini-jeu “Alice” (devinette) fonctionne après la fin des vidéos.

## ❌ Ce qui ne fonctionne pas / est manquant
### 1) Animation corrélée au son
- Il y a un début de code (`startWaveform()` dans `docs/script.js`) qui pourrait animer un visualiseur, mais **il n’est jamais appelé dans la séquence**, donc rien ne bouge en fonction du son.

### 2) Element interactif 3D
- Aucune intégration WebGL/Three.js/Babylon.js, donc il n’y a **aucun objet 3D interactif** (cube, sphère, etc.).

### 3) Cœur animé 3D
- Rien dans le projet n’implémente un **cœur 3D animé** (pulsation, rotation, etc.).

### 4) Écran noir après l’intro (problème identifié)
- Le script JavaScript plantait à cause de `await` utilisé dans des fonctions non `async`, ce qui stoppait la suite de la séquence.
- Cela a été corrigé en rendant les callbacks `async` et en ajoutant quelques logs de debug.

## ⚠️ Points à vérifier / actions recommandées
- **Tester l’enchaînement vidéo** : vérifier que `school.mp4` se lance bien après `why.mp4`, et que `craycray.mp4` se lance après `school.mp4`.
- **Activer une animation son** : appeler `startWaveform()` à un moment précis (par exemple pendant l’intro ou la musique) pour avoir un visuel lié au son.
- **Ajouter un objet 3D interactif** : intégrer Three.js/GLTF/etc. pour avoir un élément que l’utilisateur peut manipuler.
- **Ajouter un cœur animé** : peut être fait en CSS/SVG/Three.js selon l’effet désiré.

---

> Pour exécuter le projet localement :
> 1. `cd /workspaces/alice`
> 2. `python3 -m http.server 8000`
> 3. Ouvrir `http://localhost:8000/` dans un navigateur.
