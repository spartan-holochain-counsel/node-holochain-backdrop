let
  holonixPath = builtins.fetchTarball { # Aug 18, 2021
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
    holochainVersion = { # v0.0.108
      rev = "cad04aec3fb5f137b2d224ab29dcc204af7b9821"; # Sep 29, 2021
      sha256 = "1p9rqd2d2wlyzc214ia93b1f18fgqspmza863q4hrz9ba6xigzjs";
      cargoSha256 = "0p4m8ckbd7v411wgh14p0iz4dwi84i3cha5m1zgnqlln0wkqsb0f";

      lairKeystoreHashes = { # v0.0.4
        sha256 = "0khg5w5fgdp1sg22vqyzsb2ri7znbxiwl7vr2zx6bwn744wy2cyv";
        cargoSha256 = "1lm8vrxh7fw7gcir9lq85frfd0rdcca9p7883nikjfbn21ac4sn4";
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
