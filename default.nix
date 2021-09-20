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
    holochainVersion = { # v0.0.102
      rev = "6535292238dc1fbd2b60433a2054f7787e4f060e"; # Jul 29, 2021
      sha256 = "1sxpijq1rj4zra9wm5qkds8s2a363n8vbg5m9xfaib0k99fxgqas";
      cargoSha256 = "03p8vs9qaixqk67447l7q4h3cr0xyqdd1h9alxnx6y5xlz3il0rh";

      lairKeystoreHashes = { # v0.0.1-alpha.12
        sha256 = "05p8j1yfvwqg2amnbqaphc6cd92k65dq10v3afdj0k0kj42gd6ic";
        cargoSha256 = "0bd1sjx4lngi543l0bnchmpz4qb3ysf8gisary1bhxzq47b286cf";
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
