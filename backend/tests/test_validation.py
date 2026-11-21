from attacksurface.validation import is_valid_root_domain


def test_accepts_registrable_domain() -> None:
    assert is_valid_root_domain("acme-demo.com")
    assert is_valid_root_domain("sub.acme-demo.com")
    assert is_valid_root_domain("example.co.uk")


def test_rejects_ip_addresses() -> None:
    assert not is_valid_root_domain("192.168.1.1")
    assert not is_valid_root_domain("2001:db8::1")


def test_rejects_wildcards_schemes_and_paths() -> None:
    assert not is_valid_root_domain("*.acme-demo.com")
    assert not is_valid_root_domain("https://acme-demo.com")
    assert not is_valid_root_domain("acme-demo.com/path")
    assert not is_valid_root_domain("http://acme-demo.com")


def test_rejects_invalid_domains() -> None:
    assert not is_valid_root_domain("localhost")
    assert not is_valid_root_domain("-bad.com")
    assert not is_valid_root_domain("bad-.com")
    assert not is_valid_root_domain("")
    assert not is_valid_root_domain(" ")
