zsync
-----

This is another program and library for synchronizing/replicating ZFS datasets using the nodejs
platform. Source datasets are found using globs via the minimatch module. There are currently no
config files or settings stored in zfs attributes. 

todo
----

* Add snapshot rotation
* Firm up API
* Documentation
* Rename the module? Open to suggestions.
* Add --progress

install
-------

cli

```bash
npm install -g zsync
```

api

```bash
npm install zsync
```

setup
-----

Install zsync on the source and destination hosts. Make sure that the user account under which
zsync will be running on both hosts has access to the zfs command line utility and initiate a
key based SSH session.

cli
---

### example

Find the datasets you are interested in replicating

```bash
$ zsync list
pool1
pool1/sub1
pool1/sub1/swap
pool1/sub2
pool2
pool2/sub3

$ zsync list "pool1/**"
pool1/sub1
pool1/sub1/swap
pool1/sub2

$ zsync list --exclude "*/*2" "pool1/*"
pool1/sub1
```

Check the status against a destination pool on a remote server

```bash
$ zsync status --exclude "*/*2" "pool1/*" pool3 someserver
source      destination        destination-host  up-to-date  latest-snap-shot
pool1/sub1  pool3/sub1         someserver        false
```

Push a sync to a destination pool on a remote server

```bash
$ zsync push --replication --force --exclude "*/*2" "pool1/*" pool3 someserver
done
```

### list 

```
  Usage: list [options] [glob]

  list file systems

  Options:

    -h, --help                output usage information
    -u, --user [user]         remote ssh user
    -k, --key [key]           path to ssh private key
    -t, --type [type]         filter file system types
    -g, --glob [glob]         dataset-glob search glob
    -x, --exclude [glob]      exclude datasets by glob, comma separated
    -R, --recursive           recursive fs lookup
    -s, --source [dataset]    fs/vol name
    -S, --source-host [host]  host on which the source dataset resides
    -f, --format [format]     output format (json?)
    -v, --verbose             verbose output
    -V, --debug               enable debug output.
```

### status

```
  Usage: status [options] [glob] [destination] [destination-host]

  get the sync status between a source dataset and destination dataset

  Options:

    -h, --help                       output usage information
    -u, --user [user]                remote ssh user
    -k, --key [key]                  path to ssh private key
    -t, --type [type]                filter file system types
    -g, --glob [glob]                dataset-glob search glob
    -x, --exclude [glob]             exclude datasets by glob, comma separated
    -R, --recursive                  Send all fileystems/volumes in source-dataset
    -s, --source [dataset]           source-dataset, eg: pool/vol1, pool
    -S, --source-host [host]         host on which the source dataset resides
    -d, --destination [name]         destination-base, eg: pool2/virtual-disks, pool2
    -D, --destination-host [host]    host on which the destination dataset resides
    -n, --destination-drop [number]  [number] of elements to drop from the left side of [source-dataset].
    -N, --destination-keep [number]  [number] of elements to keep from the right side of [source-dataset]
    -f, --format [format]            output format (json?)
    -v, --verbose                    verbose output
    -V, --debug                      enable debug output.
```

### push

```
  Usage: push [options] [glob] [destination] [destination-host]

  push a local dataset to another dataset optionally on a remote host

  Options:

    -h, --help                       output usage information
    -u, --user [user]                remote ssh user
    -k, --key [key]                  path to ssh private key
    -t, --type [type]                filter file system types
    -g, --glob [glob]                dataset-glob search glob
    -x, --exclude [glob]             exclude datasets by glob, comma separated
    -R, --recursive                  Send all fileystems/volumes in source-dataset
    -s, --source [source-dataset]    source-dataset, eg: pool/vol1, pool
    -S, --source-host [source-host]  host on which the source dataset resides
    -d, --destination [name]         destination-base, eg: pool2/virtual-disks, pool2
    -D, --destination-host [host]    host on which the destination dataset resides
    -n, --destination-drop [number]  [number] of elements to drop from the left side of [source-dataset].
    -N, --destination-keep [number]  [number] of elements to keep from the right side of [source-dataset]
    -F, --force                      force receive (may cause rollback)
    -r, --replication                enable a replication stream
    -c, --continue                   continue on to the next dataset if errors are encountered
    -f, --format [format]            output format (json?)
    -v, --verbose                    verbose output
    -V, --debug                      enable debug output.
```

### snapshot

```
  Usage: snapshot [options] [glob] [tag] [dateformat]

  create snapshots on datasets matching a glob using an optional tag

  Options:

    -h, --help                       output usage information
    -u, --user [user]                remote ssh user
    -k, --key [key]                  path to ssh private key
    -t, --type [type]                filter file system types
    -g, --glob [glob]                dataset-glob search glob
    -x, --exclude [glob]             exclude datasets by glob, comma separated
    -R, --recursive                  Send all fileystems/volumes in source-dataset
    -s, --source [source-dataset]    source-dataset, eg: pool/vol1, pool
    -S, --source-host [source-host]  host on which the source dataset resides
    -p, --snapshot [name]            exact snapshot name to use
    -t, --tag [name]                 tag name for snapshot
    -T, --date-format [dateformat]  date format - see https://www.npmjs.com/package/dateformat. default: yyyymmddHHMMssl
    -f, --format [format]            output format (json?)
    -v, --verbose                    verbose output
    -V, --debug                      enable debug output.
```

### receive

```
  Usage: receive [options] [dataset]

  receive a dataset via stdin

  Options:

    -h, --help                   output usage information
    -u, --user [user]            remote ssh user
    -k, --key [key]              path to ssh private key
    -F, --force                  force receive (may cause rollback)
    -d, --destination [dataset]  destination-base, eg: pool2/virtual-disks, pool2
    -f, --format [format]        output format (json?)
    -v, --verbose                verbose output
    -V, --debug                  enable debug output.
```

license
-------

MIT