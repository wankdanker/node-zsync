zsync
-----

This is another program and library for synchronizing/replicating ZFS datasets using the nodejs
platform. Source datasets are found using globs via the minimatch module. There are currently no
config files or settings stored in zfs attributes. 

todo
----

* Rename the module? Open to suggestions.
* Add --progress
* Add function to remove destination snapshots that don't exist in source

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
    -T, --date-format [dateformat]   date format - see https://www.npmjs.com/package/dateformat. default: yyyymmddHHMMssl
    -f, --format [format]            output format (json?)
    -v, --verbose                    verbose output
    -V, --debug                      enable debug output.
```

### rotate

```
Usage: rotate [options] [glob] [tag] [keep]

  rotate snapshots keeping a certain number

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
    -K, --keep [number]              number of snapshots to keep
    -p, --snapshot [name]            exact snapshot name to remove
    -t, --tag [name]                 tag name to process for rotation
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

api
---

### list(opts, cb)

this function lists datasets and uses the minimatch module to filter unwanted datasets

* opts
  * glob - a comma separated or array list of globs to search for in the list of datasets
  * exclude - a comma separated or array list of globs to exclude from the list of datasets
  * type - dataset type; eg: volume,filesystem,snapshot
  * source - source dataset to restrict recursive lookups; eg: pool1
  * recursive - use recursion for the intial list lookup (ie: zfs list -r)
* cb(err, list)
  * err - error if any
  * list - array of matching datasets

### status(opts, cb)

view the sync status of datasets vs a destination dataset optionally on a remote host

* opts
  * [see opts from list]
  * destinationDrop - number of elements in the source dataset name to drop from the left
  * destinationKeep - number of elements in the source dataset name to keep from the right
  * sourceHost - host name of the source server
  * destination - name of the destination dataset; eg: pool2
  * destinationHost - host name of the destination host
* cb(err, list)
  * err - error if any
  * list - array of datasets with source and destination snapshot listings, fromSnap, toSnap and boolean work if work needs to be done

### diff(opts, cb)

This retrieves a list of snapshots for a source and destination dataset and returns both lists
and the latest common snapshot.

opts
  * source - source dataset; eg: pool1/vmdisk1
  * destination - destination dataset; eg: pool2/vmdisk2
  * destinationHost - host on which the destination dataset resides. if falsy, destination is assumed to be local

### push(opts, cb)

push source snapshots to destination dataset optionally on a destination host

* opts
  * [see opts from list]
  * destinationDrop - number of elements in the source dataset name to drop from the left
  * destinationKeep - number of elements in the source dataset name to keep from the right
  * sourceHost - host name of the source server
  * destination - name of the destination dataset; eg: pool2
  * destinationHost - host name of the destination host
  * force - force the receiving side to rollback to the most recent snapshot if data modified
  * continue - boolean; continue processing each matched datasets even if errors occur; default false

### receive(opts, cb)

Receive a dataset via opts.stream.

* opts
  * stream - a readable stream whose data is a zfs send stream

### sendreceive(opts, cb)

Initiate a zfs send and pipe it to a zfs receive optionally on a remote server

* opts
  * source - source dataset name
  * sourceHost - host on which the source dataset resides
  * destination - destination dataset (base name); eg: pool2
  * destinationHost - host on which the destination dataset resides
  * fromSnap - for an incremental send, the snapshot that marks the beginning of the incremental period
  * toSnap - the snapshot to send
  * force - force receive (zfs receive -F)
  * replication - create a replication send stream

### snap(opts, cb)

create snapshots on matching datasets

* opts
  * [see opts from list]
  * dateFormat - date format to format the timestamp included in the snapshot (see https://www.npmjs.com/package/dateformat)
  * tag - optional tag to include in the snapshot name; eg: hourly, monthly, daily, random, test, etc
  * continue - boolean; continue processing each matched datasets even if errors occur; default false

### rotate(opts, cb)

rotate snapshots with an optional tag keeping a certain number

* opts
  * [see options for list]
  * keep - number of snapshots to keep
  * tag - optional tag to include in the snapshot name; eg: hourly, monthly, daily, random, test, etc
  * sourceHost - host on which to create the snapshots

### each(opts, fn, cb)

Obtain a list of datasets from the list function then pass each dataset to fn. When done cb is called

* opts
  * type - dataset type; eg: volume;filesystem;snapshot
  * recurseive - recursively search datasets
  * glob - comma separated search globs
  * exclude - comma separated globs to exclude
  * source - source dataset
  * host - host on which to execute list command; default is local
* fn(dataset, next)
  * dataset - a dataset object which describes a matched dataset
    * name - name of the dataset
    * used - amount of space used by dataset
    * avail - amount of space available if dataset is removed
    * refer - amount of spaced referenced by the dataset
    * mountpoint - path to where the dataset is mounted
  * next(doMore) - call this function when you are done doing things with dataset.
    * Pass true if you want to want to process the next dataset (if any)
    * Pass false if you want to end processing

license
-------

MIT