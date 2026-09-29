Drop the APK to publish in this directory, next to an optional `notes.txt`.

One `*.apk` is enough. On deploy the site reads `versionName` and `versionCode` from that file, copies it onto the Railway volume, and writes `release.json`. The homepage renders only that manifest.

The volume is mounted at `/app/releases`, which hides this directory inside the container. The build copies the drop here to `/app/apk-incoming` before the process starts.
