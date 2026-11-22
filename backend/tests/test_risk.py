import pytest

from attacksurface.risk import domain_risk, rule_ids, signup_risk

BASE = {"claims": 1, "failed_domains": 0, "prior_risk": "low", "email_matches": False, "review_all": False}


@pytest.mark.parametrize(
    ("root", "overrides", "level", "rules"),
    [
        ("thakardhruv.me", {}, "low", []),
        ("example.gov.uk", {}, "high", ["sensitive_tld"]),
        ("city.gc.ca", {}, "high", ["sensitive_tld"]),
        ("school.edu", {}, "high", ["sensitive_tld"]),
        ("login.paypal.com", {}, "high", ["sensitive_brand"]),
        ("notpaypal.com", {}, "low", []),  # label boundary, not a substring match
        ("example.com", {"claims": 3}, "low", []),
        ("example.com", {"claims": 4}, "medium", ["claims_1h"]),
        ("example.com", {"failed_domains": 2}, "low", []),
        ("example.com", {"failed_domains": 3}, "medium", ["failed_checks_1h"]),
        ("example.com", {"prior_risk": "medium"}, "medium", ["prior_flag"]),
        ("example.com", {"prior_risk": "high"}, "high", ["prior_flag"]),
        ("example.com", {"review_all": True}, "medium", ["review_all"]),
        ("example.com", {"email_matches": True}, "low", ["email_domain_match"]),
        # email match never bypasses sensitive-domain review
        ("example.gov.uk", {"email_matches": True}, "high", ["sensitive_tld", "email_domain_match"]),
    ],
)
def test_domain_risk_table(root, overrides, level, rules):
    got_level, signals = domain_risk(root, **{**BASE, **overrides})
    assert got_level == level
    assert rule_ids(signals) == rules


@pytest.mark.parametrize(
    ("email_domain", "accounts", "level", "rules"),
    [
        ("gmail.com", 1, "low", []),
        (None, 1, "low", []),
        ("mailinator.com", 1, "medium", ["disposable_email"]),
        ("gmail.com", 2, "low", []),
        ("gmail.com", 3, "medium", ["ip_accounts_24h"]),
        ("yopmail.com", 5, "medium", ["disposable_email", "ip_accounts_24h"]),
    ],
)
def test_signup_risk_table(email_domain, accounts, level, rules):
    got_level, signals = signup_risk(email_domain, accounts)
    assert got_level == level
    assert rule_ids(signals) == rules


def test_signup_risk_never_exceeds_medium():
    # signup signals are weak on their own: they queue for review, never auto-reject
    assert signup_risk("mailinator.com", 50)[0] == "medium"
