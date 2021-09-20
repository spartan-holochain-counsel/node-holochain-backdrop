let
  holonixPath = builtins.fetchTarball {
    url = "https://github.com/holochain/holonix/archive/6ae8ffb8e5c1a1faa4f4e1af8a9f7139b2ce0f3c.tar.gz";
    sha256 = "0ksvy2m7gpxf5r7l1rznvjwajypk7iii3h5d8nx762kah55nyliq";
  };
  holonix = import (holonixPath) {
    include = {
      holochainBinaries = true;
      node = false;
      happs = false;
    };

    holochainVersionId = "custom";
    holochainVersion = { # v0.0.103
      rev = "f3d17d993ad8d988402cc01d73a0095484efbabb"; # Aug 17, 2021
      sha256 = "1z0y1bl1j2cfv4cgr4k7y0pxnkbiv5c0xv89y8dqnr32vli3bld7";
      cargoSha256 = "1rf8vg832qyymw0a4x247g0iikk6kswkllfrd5fqdr0qgf9prc31";

      lairKeystoreHashes = { # v0.0.3
        sha256 = "1jiz9y1d4ybh33h1ly24s7knsqyqjagsn1gzqbj1ngl22y5v3aqh";
        cargoSha256 = "0agykcl7ysikssfwkjgb3hfw6xl0slzy38prc4rnzvagm5wd1jjv";
      };

      bins = {
        holochain = "holochain";
        hc = "hc";
      };
    };
  };
  nixpkgs = holonix.pkgs;
in nixpkgs.mkShell {
  inputsFrom = [ holonix.main ];
}
